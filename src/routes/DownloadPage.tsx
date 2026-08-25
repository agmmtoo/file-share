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
import { CopyLinkBox } from "@/components/CopyLinkBox"
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
        if (
          err instanceof ApiError &&
          (err.status === 404 || err.status === 410)
        ) {
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
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 410)
      ) {
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
      <div className="flex items-center gap-2 border-2 border-brutal bg-card px-3 py-2 text-xs font-bold tracking-widest uppercase shadow-brutal">
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
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            {gone === "expired" ? (
              <Timer className="size-5" />
            ) : (
              <FileWarning className="size-5" />
            )}
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
            size="lg"
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
          <CardTitle className="text-base uppercase">
            Something went wrong
          </CardTitle>
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
        <CardTitle className="text-base break-all">{meta!.name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="border-2 border-brutal px-1.5 py-px text-[10px] font-bold tracking-widest text-foreground uppercase">
            {formatBytes(meta!.size)}
          </span>
          <span className="flex items-center gap-1 border-2 border-brutal px-1.5 py-px text-[10px] font-bold tracking-widest text-foreground uppercase">
            <Clock className="size-3" />
            {timeLeft(meta!.expiresAt)} left
          </span>
          {meta!.encrypted && (
            <span className="flex items-center gap-1 border-2 border-brutal bg-brand px-1.5 py-px text-[10px] font-bold tracking-widest text-brand-foreground uppercase">
              <Lock className="size-3" />
              encrypted
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <QrCode text={shareUrl} />
          <CopyLinkBox url={shareUrl} />
        </div>

        {missingKey && (
          <p className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            This file is encrypted and the link is missing its decryption key
            (the part after <span className="font-bold">#</span>). Ask the
            sender for the full link.
          </p>
        )}

        {busy && <Progress value={progress} />}
        {phase === "saved" && (
          <p className="border-2 border-brutal bg-success px-2.5 py-2 text-xs font-bold tracking-wide text-success-foreground uppercase">
            Saved to your device.
          </p>
        )}
        {phase === "failed" && (
          <p className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {errorMsg}
          </p>
        )}

        <Button
          onClick={handleDownload}
          disabled={busy || missingKey}
          size="lg"
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
