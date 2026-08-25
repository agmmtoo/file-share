import { useEffect, useRef, useState } from "react"

export type CopyStatus = "idle" | "copied" | "failed"

export function useCopy(text: string, resetAfter = 1600) {
  const [status, setStatus] = useState<CopyStatus>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // writeText rejects when the clipboard is blocked (no focus, no permission,
  // insecure context). Say so instead of leaving the click looking dead.
  const copy = async () => {
    let next: CopyStatus = "copied"
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      next = "failed"
    }
    setStatus(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus("idle"), resetAfter)
    return next
  }

  return {
    status,
    copied: status === "copied",
    failed: status === "failed",
    copy,
  }
}
