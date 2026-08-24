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
        <CardTitle>Share a file</CardTitle>
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
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-accent data-dragging:border-primary data-dragging:bg-primary/10"
          >
            <Upload className="size-6 text-muted-foreground" />
            <span className="font-medium text-sm">
              {dragging
                ? "Drop to attach"
                : file
                  ? file.name
                  : "Drop a file here, or click to choose"}
            </span>
            {file && !dragging && (
              <span className="text-muted-foreground text-xs">
                {formatBytes(file.size)}
              </span>
            )}
          </Label>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Expires after</Label>
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
                className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border p-2.5 font-normal text-sm transition-colors hover:bg-accent has-[[data-slot=radio-group-item][data-checked]]:border-primary has-[[data-slot=radio-group-item][data-checked]]:bg-primary/10"
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <Label htmlFor="encrypt-switch" className="cursor-pointer">
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

        {phase === "uploading" && (
          <Progress value={progress} className="h-2" />
        )}
        {phase === "done" && (
          <p className="text-muted-foreground text-sm">
            Share link created — opening…
          </p>
        )}
        {phase === "error" && (
          <p className="text-destructive text-sm">{errorMsg}</p>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || busy || tooLarge || phase === "done"}
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
          <Button variant="outline" onClick={reset} className="w-full">
            Start over
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
