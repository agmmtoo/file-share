import { ApiError } from "@/lib/api"
import { formatBytes } from "@/lib/format"

/** Turns an API error code into something worth showing a person. */
export function describeError(err: unknown, maxFileSize?: number): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "file_too_large":
        return maxFileSize
          ? `That file is over the ${formatBytes(maxFileSize)} limit.`
          : "That file is too large."
      case "rate_limited":
        return "Too many requests from your network. Wait a minute and try again."
      case "expired":
        return "This link expired while you were using it."
      case "not_found":
        return "This share no longer exists."
      case "unauthorized":
        return "Your session ended. Sign in again."
      case "download_limit_reached":
        return "This link hit its download limit."
      case "expiry_not_allowed":
        return "That expiry needs an account. Sign in and try again."
      case "download_limit_not_allowed":
        return "Download limits need an account. Sign in and try again."
      case "already_uploaded":
        return "This link was already used. Start over to share again."
      case "network_error":
        return "Lost the connection. Check your network and try again."
      case "invalid_request":
        return "The server rejected the request. Try picking the file again."
      default:
        return err.status >= 500
          ? "The server had a problem. Try again in a moment."
          : "Upload failed. Try again."
    }
  }
  return err instanceof Error && err.message
    ? err.message
    : "Something went wrong."
}
