import { useRef } from "react"
import { Check, Copy, X } from "lucide-react"
import { useCopy } from "@/hooks/use-copy"
import { cn } from "@/lib/utils"

/**
 * The share link, as one slab: sticker label, the URL, and a copy button
 * welded to the right edge. The whole slab is clickable.
 */
export function CopyLinkBox({ url }: { url: string }) {
  const { copied, failed, copy } = useCopy(url)
  const urlRef = useRef<HTMLElement>(null)

  // When the clipboard API is blocked, select the link so Ctrl+C still works.
  const handleClick = async () => {
    const result = await copy()
    if (result !== "failed" || !urlRef.current) return
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(urlRef.current)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return (
    <div className="relative w-full pt-2">
      <span
        aria-hidden
        className={cn(
          "absolute -top-0.5 left-2 z-10 -rotate-2 border-2 border-brutal px-1.5 py-px text-[10px] font-bold tracking-widest uppercase transition-colors duration-200",
          copied && "bg-success text-success-foreground",
          failed && "bg-destructive text-white",
          !copied && !failed && "bg-brand text-brand-foreground"
        )}
      >
        {copied ? "Copied!" : failed ? "Press Ctrl+C" : "Share link"}
      </span>

      <button
        type="button"
        onClick={handleClick}
        aria-label={
          copied
            ? "Link copied to clipboard"
            : failed
              ? "Copy failed, select the link and copy it manually"
              : `Copy link ${url}`
        }
        className={cn(
          "group flex w-full brutal-press items-stretch border-2 border-brutal text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brutal",
          copied && "bg-success",
          failed && "border-destructive",
          !copied && "bg-background"
        )}
      >
        <code
          ref={urlRef}
          className={cn(
            "flex-1 overflow-hidden pt-3.5 pr-2 pb-2.5 pl-3 text-xs text-ellipsis whitespace-nowrap transition-colors duration-200",
            copied ? "text-success-foreground" : "text-foreground"
          )}
        >
          {url}
        </code>
        <span
          className={cn(
            "grid w-11 shrink-0 place-items-center self-stretch border-l-2 border-brutal transition-colors duration-200",
            copied && "bg-success text-success-foreground",
            failed && "bg-destructive text-white",
            !copied &&
              !failed &&
              "bg-muted text-foreground group-hover:bg-brand group-hover:text-brand-foreground"
          )}
        >
          <span className="relative grid size-4 place-items-center">
            {failed ? (
              <X className="col-start-1 row-start-1 size-4" />
            ) : (
              <>
                <Copy
                  className={cn(
                    "col-start-1 row-start-1 size-4 transition-all duration-200",
                    copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
                  )}
                />
                <Check
                  className={cn(
                    "col-start-1 row-start-1 size-4 transition-all duration-200",
                    copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  )}
                />
              </>
            )}
          </span>
        </span>
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : failed ? "Copy failed" : ""}
      </span>
    </div>
  )
}
