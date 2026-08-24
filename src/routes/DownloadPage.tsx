import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import {
  Clock,
  Download,
  FileWarning,
  Loader2,
  Lock,
  Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CopyButton } from "@/components/CopyButton"
import { QrCode } from "@/components/QrCode"
import { ApiError, downloadFile, getFile, saveBlob } from "@/lib/api"
import { decryptData } from "@/lib/crypto"
import { describeError } from "@/lib/errors"
import { formatBytes, timeLeft } from "@/lib/format"
import type { FileMeta } from "../../shared/types"

type LoadState =
  | { status: "loading" }
  | { status: "ready"; meta: FileMeta }
  | { status: "gone"; reason: "not_found" | "expired" }
  | { status: "error"; message: string }

type Phase = "idle" | "downloading" | "decrypting" | "saved" | "failed"

export function DownloadPage() {
  const { id = "" } = useParams<{ id: string }>()
  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")
  const [now, setNow] = useState(() => Date.now())

  // Key never leaves the browser: it lives only in the URL fragment.
  const [keyB64] = useState(() => window.location.hash.slice(1))

  useEffect(() => {
    let cancelled = false
    getFile(id)
      .then((meta) => {
        if (!cancelled) setLoad({ status: "ready", meta })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
          setLoad({
            status: "gone",
            reason: err.status === 410 ? "expired" : "not_found",
          })
        } else {
          setLoad({ status: "error", message: describeError(err) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Keep the "expires in" line honest without reloading.
  useEffect(() => {
    if (load.status !== "ready") return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [load.status])

  const meta = load.status === "ready" ? load.meta : null
  const expired = meta ? meta.expiresAt <= now : false
  const missingKey = Boolean(meta?.encrypted) && keyB64.length === 0

  const handleDownload = useCallback(async () => {
    if (!meta) return
    setErrorMsg("")
    setProgress(0)
    setPhase("downloading")
    try {
      const blob = await downloadFile(meta.id, setProgress)
      if (meta.encrypted) {
        setPhase("decrypting")
        const plain = await decryptData(await blob.arrayBuffer(), keyB64)
        saveBlob(new Blob([plain]), meta.name)
      } else {
        saveBlob(blob, meta.name)
      }
      setPhase("saved")
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
        setLoad({
          status: "gone",
          reason: err.status === 410 ? "expired" : "not_found",
        })
        return
      }
      setErrorMsg(
        meta.encrypted && !(err instanceof ApiError)
          ? "Could not decrypt this file. The link's key is wrong or incomplete."
          : describeError(err)
      )
      setPhase("failed")
    }
  }, [meta, keyB64])

  if (load.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (load.status === "gone" || expired) {
    const gone = load.status === "gone" ? load.reason : "expired"
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {gone === "expired" ? <Timer className="size-5" /> : <FileWarning className="size-5" />}
            {gone === "expired" ? "This link has expired" : "Nothing here"}
          </CardTitle>
          <CardDescription>
            {gone === "expired"
              ? "The file was deleted when its timer ran out."
              : "This share link is invalid or was already cleaned up."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            render={<a href="/" />}
          >
            Share a file instead
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (load.status === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>{load.message}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const shareUrl = `${window.location.origin}/f/${meta!.id}${keyB64 ? `#${keyB64}` : ""}`
  const busy = phase === "downloading" || phase === "decrypting"

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="break-all">{meta!.name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{formatBytes(meta!.size)}</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            expires in {timeLeft(meta!.expiresAt)}
          </span>
          {meta!.encrypted && (
            <span className="flex items-center gap-1">
              <Lock className="size-3.5" />
              end-to-end encrypted
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <QrCode text={shareUrl} />
          <div className="flex w-full items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-xs">
              {shareUrl}
            </code>
            <CopyButton url={shareUrl} />
          </div>
        </div>

        {missingKey && (
          <p className="text-destructive text-sm">
            This file is encrypted and the link is missing its decryption key
            (the part after <span className="font-mono">#</span>). Ask the sender
            for the full link.
          </p>
        )}

        {busy && <Progress value={progress} className="h-2" />}
        {phase === "saved" && (
          <p className="text-muted-foreground text-sm">Saved to your device.</p>
        )}
        {phase === "failed" && (
          <p className="text-destructive text-sm">{errorMsg}</p>
        )}

        <Button
          onClick={handleDownload}
          disabled={busy || missingKey}
          className="w-full"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              {phase === "downloading"
                ? `Downloading ${progress}%`
                : "Decrypting…"}
            </>
          ) : (
            <>
              <Download />
              Download
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
