import { useEffect, useRef } from "react"
import QRCode from "qrcode"

export function QrCode({ text, size = 160 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, text, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {})
  }, [text, size])

  return <canvas ref={ref} className="rounded-md border bg-white p-2" />
}
