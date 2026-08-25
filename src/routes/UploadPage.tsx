import { useCallback, useEffect, useState } from "react"
import { Link2, Loader2, Lock, Upload } from "lucide-react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { createUpload, getConfig, uploadBlob } from "@/lib/api"
import { encryptData, generateKeyB64 } from "@/lib/crypto"
import { describeError } from "@/lib/errors"
import { formatBytes } from "@/lib/format"
import type { ExpiryOption } from "../../shared/types"

type Phase = "idle" | "encrypting" | "creating" | "uploading" | "done" | "error"

const EXPIRY_CHOICES: { value: ExpiryOption; label: string }[] = [
  { value: "5m", label: "5 min" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
]

export function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [expiry, setExpiry] = useState<ExpiryOption>("5m")
  const [encrypt, setEncrypt] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")
  const [sharePath, setSharePath] = useState("")
  const [maxFileSize, setMaxFileSize] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    getConfig()
      .then((config) => {
        if (!cancelled) setMaxFileSize(config.maxFileSize)
      })
      .catch(() => {
        // Non-fatal: the server still enforces the real limit on upload.
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    setExpiry("5m")
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
      })

      setPhase("uploading")
      await uploadBlob(id, payload, setProgress)

      setSharePath(`/f/${id}${keyB64 ? `#${keyB64}` : ""}`)
      setPhase("done")
    } catch (err) {
      setErrorMsg(describeError(err, maxFileSize ?? undefined))
      setPhase("error")
    }
  }, [file, expiry, encrypt, maxFileSize])

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
            {EXPIRY_CHOICES.map((choice) => (
              <Label
                key={choice.value}
                htmlFor={`expiry-${choice.value}`}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-none border-2 border-brutal p-2.5 text-xs font-bold tracking-wide uppercase transition-all duration-150 ease-(--ease-brutal) hover:-translate-y-0.5 hover:shadow-brutal-sm has-[[data-slot=radio-group-item][data-checked]]:-translate-y-0.5 has-[[data-slot=radio-group-item][data-checked]]:bg-brand has-[[data-slot=radio-group-item][data-checked]]:text-brand-foreground has-[[data-slot=radio-group-item][data-checked]]:shadow-brutal-sm"
              >
                <RadioGroupItem
                  value={choice.value}
                  id={`expiry-${choice.value}`}
                  className="sr-only"
                />
                {choice.label}
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
