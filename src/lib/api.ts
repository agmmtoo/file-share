import type {
  AppConfig,
  CreateUploadInput,
  CreateUploadResult,
  FileMeta,
} from "../../shared/types"

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(`API error ${status}: ${code}`)
    this.status = status
    this.code = code
  }
}

async function parseError(res: Response): Promise<never> {
  let code = "unknown_error"
  try {
    const body = (await res.json()) as { error?: string }
    if (body.error) code = body.error
  } catch {
    // keep default
  }
  throw new ApiError(res.status, code)
}

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config")
  if (!res.ok) await parseError(res)
  return res.json()
}

export async function createUpload(
  input: CreateUploadInput
): Promise<CreateUploadResult> {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) await parseError(res)
  return res.json()
}

export function uploadBlob(
  id: string,
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", `/api/uploads/${id}`)
    xhr.setRequestHeader("Content-Type", "application/octet-stream")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new ApiError(xhr.status, `upload_failed_${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, "network_error"))
    xhr.send(blob)
  })
}

export async function getFile(id: string): Promise<FileMeta> {
  const res = await fetch(`/api/files/${id}`)
  if (!res.ok) await parseError(res)
  return res.json()
}

export async function downloadFile(
  id: string,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const res = await fetch(`/api/files/${id}/blob`)
  if (!res.ok) await parseError(res)

  if (!onProgress || !res.body) return res.blob()

  const total = Number(res.headers.get("Content-Length") ?? 0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(total > 0 ? Math.round((loaded / total) * 100) : 0)
  }
  return new Blob(chunks as BlobPart[])
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  // Firefox needs the anchor in the document, and revoking too early can
  // cancel the download, so hold the url for a tick.
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
