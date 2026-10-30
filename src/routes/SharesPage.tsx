import { useCallback, useEffect, useState } from "react"
import { Clock, Download, Loader2, Lock, Trash2, Upload } from "lucide-react"
import { Link, Navigate } from "react-router"
import { CopyButton } from "@/components/CopyButton"
import { MetaBadge } from "@/components/MetaBadge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { deleteShare, listShares } from "@/lib/api"
import { useSession } from "@/lib/auth"
import { describeError } from "@/lib/errors"
import { formatBytes, timeLeft } from "@/lib/format"
import type { FileMeta } from "../../shared/types"

type Load =
  | { status: "loading" }
  | { status: "ready"; shares: FileMeta[] }
  | { status: "error"; message: string }

export function SharesPage() {
  const { data: session, isPending } = useSession()
  const [load, setLoad] = useState<Load>({ status: "loading" })
  // Deleting is irreversible, so the row asks once before it goes.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listShares()
      .then((shares) => {
        if (!cancelled) setLoad({ status: "ready", shares })
      })
      .catch((err) => {
        if (!cancelled) {
          setLoad({ status: "error", message: describeError(err) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const remove = useCallback(async (id: string) => {
    setDeleting(id)
    setErrorMsg("")
    try {
      await deleteShare(id)
      setLoad((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              shares: current.shares.filter((share) => share.id !== id),
            }
          : current
      )
    } catch (err) {
      setErrorMsg(describeError(err))
    } finally {
      setDeleting(null)
      setConfirming(null)
    }
  }, [])

  if (isPending) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="size-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // The listing is per-account, so there is nothing to show a signed-out visitor.
  if (!session) return <Navigate to="/login" replace />

  const shares = load.status === "ready" ? load.shares : []
  const anyEncrypted = shares.some((share) => share.encrypted)

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-base uppercase">Your shares</CardTitle>
        <CardDescription>
          Live links only. Expired ones drop off on their own.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {load.status === "loading" && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {load.status === "error" && (
          <p className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {load.message}
          </p>
        )}

        {load.status === "ready" && shares.length === 0 && (
          <p className="border-2 border-dashed border-brutal px-2.5 py-6 text-center text-xs tracking-wide text-muted-foreground">
            Nothing shared yet.
          </p>
        )}

        {shares.map((share) => (
          <div
            key={share.id}
            className="flex flex-col gap-2.5 border-2 border-brutal bg-card p-2.5 shadow-brutal-sm"
          >
            <span className="text-sm font-bold break-all">{share.name}</span>

            <div className="flex flex-wrap items-center gap-1.5">
              <MetaBadge>{formatBytes(share.size)}</MetaBadge>
              <MetaBadge>
                <Clock className="size-3" />
                {timeLeft(share.expiresAt)} left
              </MetaBadge>
              {share.encrypted && (
                <MetaBadge tone="brand">
                  <Lock className="size-3" />
                  encrypted
                </MetaBadge>
              )}
              <MetaBadge>
                <Download className="size-3" />
                {share.maxDownloads === null
                  ? `${share.downloads} taken`
                  : `${Math.max(0, share.maxDownloads - share.downloads)} of ${share.maxDownloads} left`}
              </MetaBadge>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 truncate border-2 border-brutal bg-muted px-2 py-1 text-[10px] tracking-wide">
                /f/{share.id}
              </code>
              <CopyButton
                url={`${window.location.origin}/f/${share.id}`}
                className="size-8"
              />
              {confirming === share.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting === share.id}
                  onClick={() => remove(share.id)}
                >
                  {deleting === share.id ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Delete
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Delete ${share.name}`}
                  onClick={() => setConfirming(share.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        ))}

        {errorMsg && (
          <p className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {errorMsg}
          </p>
        )}

        {anyEncrypted && (
          <p className="border-2 border-dashed border-brutal px-2.5 py-2 text-[10px] tracking-wide text-muted-foreground">
            An encrypted share needs the key after the{" "}
            <span className="font-bold">#</span> in the link you were given. The
            server never sees it, so copying from here leaves it out.
          </p>
        )}

        <Button
          render={<Link to="/" />}
          nativeButton={false}
          variant="outline"
          size="lg"
          className="w-full"
        >
          <Upload />
          Share another file
        </Button>
      </CardContent>
    </Card>
  )
}
