import type { CSSProperties } from "react"

type Shape = "square" | "circle" | "cross"
type Tone = "outline" | "brand" | "solid"

type Block = {
  shape: Shape
  tone: Tone
  /** Percentages, so the arrangement survives any viewport. Right-hand blocks
      are anchored with `right` so they cannot hang off a narrow screen. */
  top: number
  left?: number
  right?: number
  size: number
  rotate: number
  /** How far it drifts over one leg of the loop. */
  travel: number
  turn: number
  duration: number
  delay: number
  opacity: number
}

/**
 * Hand-placed rather than random: the blocks sit out near the edges, away from
 * the column the cards occupy, and a fixed list renders the same on every load.
 */
const BLOCKS: Block[] = [
  {
    shape: "square",
    tone: "outline",
    top: 14,
    left: 4,
    size: 86,
    rotate: -8,
    travel: -26,
    turn: 7,
    duration: 19,
    delay: 0,
    opacity: 0.16,
  },
  {
    shape: "circle",
    tone: "outline",
    top: 66,
    left: 8,
    size: 54,
    rotate: 0,
    travel: 22,
    turn: 0,
    duration: 23,
    delay: 1.5,
    opacity: 0.13,
  },
  {
    shape: "cross",
    tone: "solid",
    top: 38,
    left: 13,
    size: 28,
    rotate: 0,
    travel: 0,
    turn: 0,
    duration: 32,
    delay: 0,
    opacity: 0.12,
  },
  {
    shape: "square",
    tone: "brand",
    top: 80,
    left: 17,
    size: 34,
    rotate: 12,
    travel: -18,
    turn: -9,
    duration: 17,
    delay: 2.5,
    opacity: 0.22,
  },
  {
    shape: "square",
    tone: "outline",
    top: 22,
    right: 5,
    size: 64,
    rotate: 10,
    travel: 24,
    turn: -6,
    duration: 21,
    delay: 0.8,
    opacity: 0.15,
  },
  {
    shape: "cross",
    tone: "solid",
    top: 54,
    right: 8,
    size: 32,
    rotate: 0,
    travel: 0,
    turn: 0,
    duration: 28,
    delay: 1,
    opacity: 0.14,
  },
  {
    shape: "circle",
    tone: "brand",
    top: 74,
    right: 16,
    size: 26,
    rotate: 0,
    travel: 20,
    turn: 0,
    duration: 25,
    delay: 3,
    opacity: 0.2,
  },
  {
    shape: "square",
    tone: "outline",
    top: 86,
    right: 4,
    size: 96,
    rotate: -14,
    travel: -20,
    turn: 8,
    duration: 26,
    delay: 1.8,
    opacity: 0.12,
  },
  {
    shape: "square",
    tone: "outline",
    top: 46,
    left: 2,
    size: 40,
    rotate: 20,
    travel: 16,
    turn: -10,
    duration: 20,
    delay: 4,
    opacity: 0.14,
  },
]

/**
 * The page's backdrop: a panning grid with outlined blocks drifting across it.
 * Decoration only, so it is hidden from assistive tech and never takes a click.
 */
export function Backdrop() {
  return (
    <div className="backdrop-layer" aria-hidden="true">
      <div className="backdrop-grid" />
      {BLOCKS.map((block, i) => (
        <div
          key={i}
          className="backdrop-block"
          data-shape={block.shape}
          data-tone={block.tone}
          style={
            {
              top: `${block.top}%`,
              left: block.left === undefined ? undefined : `${block.left}%`,
              right: block.right === undefined ? undefined : `${block.right}%`,
              width: block.size,
              height: block.size,
              opacity: block.opacity,
              "--block-rotate": `${block.rotate}deg`,
              "--block-travel": `${block.travel}px`,
              "--block-turn": `${block.turn}deg`,
              "--block-duration": `${block.duration}s`,
              "--block-delay": `${block.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
