import { useCallback, useEffect, useState } from "react"
import { Download, Link2, Loader2, Lock, Upload } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { createUpload, getConfig, uploadBlob } from "@/lib/api"
import { useSession } from "@/lib/auth"
import { encryptData, generateKeyB64 } from "@/lib/crypto"
import { describeError } from "@/lib/errors"
import { expiryLabel, formatBytes } from "@/lib/format"
import {
  MAX_DOWNLOAD_LIMIT,
  TIERS,
  type AppConfig,
  type ExpiryOption,
} from "../../shared/types"

type Phase = "idle" | "encrypting" | "creating" | "uploading" | "done" | "error"

/** Compact forms for the radio row; expiryLabel() is the long form. */
const SHORT_EXPIRY: Record<ExpiryOption, string> = {
  "5m": "5 min",
  "1h": "1 hour",
  "24h": "24 h",
  "7d": "7 days",
  "30d": "30 days",
}

export function UploadPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [expiry, setExpiry] = useState<ExpiryOption>("5m")
  const [encrypt, setEncrypt] = useState(false)
  const [limitDownloads, setLimitDownloads] = useState(false)
  const [maxDownloads, setMaxDownloads] = useState("1")
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")
  const [sharePath, setSharePath] = useState("")
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [dragging, setDragging] = useState(false)

  const maxFileSize = config?.maxFileSize ?? null
  const userId = session?.user.id ?? null

  // Keyed on the session: signing in or out changes the caller's tier, so the
  // limits have to be re-read rather than kept from the anonymous page load.
  useEffect(() => {
    let cancelled = false
    getConfig()
      .then((next) => {
        if (cancelled) return
        setConfig(next)
        // Drop an expiry the new tier no longer allows (sign-out from 30d).
        setExpiry((current) =>
          next.expiryOptions.includes(current) ? current : next.expiryOptions[0]
        )
        if (!next.canLimitDownloads) setLimitDownloads(false)
      })
      .catch(() => {
        // Non-fatal: the server still enforces the real limits on upload.
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const busy =
    phase === "encrypting" || phase === "creating" || phase === "uploading"
  const tooLarge =
    file !== null && maxFileSize !== null && file.size > maxFileSize

  const reset = () => {
    setFile(null)
    setPhase("idle")
    setProgress(0)
    setErrorMsg("")
    setSharePath("")
    setEncrypt(false)
    setExpiry(config?.expiryOptions[0] ?? "5m")
    setLimitDownloads(false)
    setMaxDownloads("1")
  }

  const selectFile = useCallback(
    (next: File | null) => {
      setFile(next)
      setProgress(0)
      if (next && maxFileSize !== null && next.size > maxFileSize) {
        setErrorMsg(`That file is over the ${formatBytes(maxFileSize)} limit.`)
        setPhase("error")
      } else {
        setErrorMsg("")
        setPhase("idle")
      }
    },
    [maxFileSize]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (busy) return
      selectFile(e.dataTransfer.files?.[0] ?? null)
    },
    [busy, selectFile]
  )

  const handleUpload = useCallback(async () => {
    if (!file) return
    setPhase("encrypting")
    setErrorMsg("")

    try {
      let payload: Blob = file
      let keyB64: string | null = null

      if (encrypt) {
        keyB64 = await generateKeyB64()
        const data = await file.arrayBuffer()
        const encrypted = await encryptData(data, keyB64)
        payload = new Blob([encrypted as BlobPart], {
          type: "application/octet-stream",
        })
      }

      setPhase("creating")
      const { id } = await createUpload({
        name: file.name,
        size: payload.size,
        contentType: file.type || "application/octet-stream",
        encrypted: encrypt,
        expiresIn: expiry,
        maxDownloads: limitDownloads ? Number(maxDownloads) : null,
      })

      setPhase("uploading")
      await uploadBlob(id, payload, setProgress)

      setSharePath(`/f/${id}${keyB64 ? `#${keyB64}` : ""}`)
      setPhase("done")
    } catch (err) {
      setErrorMsg(describeError(err, maxFileSize ?? undefined))
      setPhase("error")
    }
  }, [file, expiry, encrypt, limitDownloads, maxDownloads, maxFileSize])

  useEffect(() => {
    if (phase !== "done" || !sharePath) return
    navigate(sharePath, { replace: true })
  }, [phase, sharePath, navigate])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-base uppercase">Share a file</CardTitle>
        <CardDescription>
          Files are stored temporarily and expire automatically.
          {maxFileSize !== null && ` ${formatBytes(maxFileSize)} max.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            id="file-input"
            type="file"
            className="sr-only"
            disabled={busy}
            onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
          />
          <Label
            htmlFor="file-input"
            data-dragging={dragging || undefined}
            data-selected={file ? true : undefined}
            className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-3 border-dashed border-brutal p-8 text-center transition-all duration-200 ease-(--ease-brutal) hover:-translate-y-0.5 hover:bg-muted hover:shadow-brutal data-dragging:-translate-y-1 data-dragging:scale-[1.01] data-dragging:border-solid data-dragging:bg-brand data-dragging:text-brand-foreground data-dragging:shadow-brutal-lg data-selected:border-solid data-selected:bg-muted data-selected:shadow-brutal-sm"
          >
            <Upload className="size-7 transition-transform duration-200 ease-(--ease-brutal) group-data-dragging:-translate-y-0.5" />
            <span className="text-sm font-bold tracking-tight break-all">
              {dragging
                ? "Drop to attach"
                : file
                  ? file.name
                  : "Drop a file here, or click to choose"}
            </span>
            {file && !dragging && (
              <span className="border-2 border-brutal bg-brand px-1.5 py-px text-[10px] font-bold tracking-widest text-brand-foreground uppercase">
                {formatBytes(file.size)}
              </span>
            )}
          </Label>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-[10px] font-bold tracking-widest uppercase">
            Expires after
          </Label>
          <RadioGroup
            value={expiry}
            onValueChange={(v) => setExpiry(v as ExpiryOption)}
            className="flex gap-2"
            disabled={busy}
          >
            {(config?.expiryOptions ?? ["5m"]).map((option) => (
              <Label
                key={option}
                htmlFor={`expiry-${option}`}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-none border-2 border-brutal p-2.5 text-xs font-bold tracking-wide uppercase transition-all duration-150 ease-(--ease-brutal) hover:-translate-y-0.5 hover:shadow-brutal-sm has-[[data-slot=radio-group-item][data-checked]]:-translate-y-0.5 has-[[data-slot=radio-group-item][data-checked]]:bg-brand has-[[data-slot=radio-group-item][data-checked]]:text-brand-foreground has-[[data-slot=radio-group-item][data-checked]]:shadow-brutal-sm"
              >
                <RadioGroupItem
                  value={option}
                  id={`expiry-${option}`}
                  className="sr-only"
                />
                {SHORT_EXPIRY[option]}
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between border-2 border-brutal bg-muted p-2.5 transition-colors duration-200 has-[[data-checked]]:bg-brand has-[[data-checked]]:text-brand-foreground">
          <div className="flex items-center gap-2">
            <Lock className="size-4" />
            <Label
              htmlFor="encrypt-switch"
              className="cursor-pointer text-[10px] font-bold tracking-widest uppercase"
            >
              End-to-end encrypted
            </Label>
          </div>
          <Switch
            id="encrypt-switch"
            checked={encrypt}
            onCheckedChange={setEncrypt}
            disabled={busy}
          />
        </div>

        {config?.canLimitDownloads ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-2 border-brutal bg-muted p-2.5 transition-colors duration-200 has-[[data-checked]]:bg-brand has-[[data-checked]]:text-brand-foreground">
              <div className="flex items-center gap-2">
                <Download className="size-4" />
                <Label
                  htmlFor="limit-switch"
                  className="cursor-pointer text-[10px] font-bold tracking-widest uppercase"
                >
                  Limit downloads
                </Label>
              </div>
              <Switch
                id="limit-switch"
                checked={limitDownloads}
                onCheckedChange={setLimitDownloads}
                disabled={busy}
              />
            </div>
            {limitDownloads && (
              <div className="flex items-center gap-2.5">
                <Label
                  htmlFor="max-downloads"
                  className="text-[10px] font-bold tracking-widest uppercase"
                >
                  Allowed
                </Label>
                <Input
                  id="max-downloads"
                  type="number"
                  min={1}
                  max={MAX_DOWNLOAD_LIMIT}
                  value={maxDownloads}
                  onValueChange={(v) => setMaxDownloads(String(v))}
                  disabled={busy}
                  className="w-24"
                />
                <span className="text-[10px] text-muted-foreground">
                  download{Number(maxDownloads) === 1 ? "" : "s"}, then the link
                  dies
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="border-2 border-dashed border-brutal px-2.5 py-2 text-[10px] tracking-wide text-muted-foreground">
            <Link
              to="/signup"
              className="font-bold text-foreground underline decoration-2 underline-offset-2"
            >
              Create an account
            </Link>{" "}
            for {formatBytes(TIERS.member.maxFileSize)} uploads, links up to{" "}
            {expiryLabel("30d")}, and download limits.
          </p>
        )}

        {phase === "uploading" && <Progress value={progress} />}
        {phase === "done" && (
          <p className="border-2 border-brutal bg-success px-2.5 py-2 text-xs font-bold tracking-wide text-success-foreground uppercase">
            Share link created, opening…
          </p>
        )}
        {phase === "error" && (
          <p className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {errorMsg}
          </p>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || busy || tooLarge || phase === "done"}
          size="lg"
          className="w-full"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              {phase === "encrypting" && "Encrypting…"}
              {phase === "creating" && "Creating link…"}
              {phase === "uploading" && `Uploading ${progress}%`}
            </>
          ) : (
            <>
              <Link2 />
              Create share link
            </>
          )}
        </Button>

        {phase === "error" && (
          <Button
            variant="outline"
            size="lg"
            onClick={reset}
            className="w-full"
          >
            Start over
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
