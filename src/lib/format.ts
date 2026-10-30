import type { ExpiryOption } from "../../shared/types"

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function expiryLabel(option: ExpiryOption): string {
  switch (option) {
    case "5m":
      return "5 minutes"
    case "1h":
      return "1 hour"
    case "24h":
      return "24 hours"
    case "7d":
      return "7 days"
    case "30d":
      return "30 days"
  }
}

export function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return "expired"
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "less than a minute"
  const hours = Math.floor(mins / 60)
  if (hours < 1) return `${mins} min`
  // Member shares run to 30 days, where an hour count stops being readable.
  const days = Math.floor(hours / 24)
  if (days >= 1) return days === 1 ? "1 day" : `${days} days`
  return `${hours} h ${mins % 60} min`
}
