const IV_LENGTH = 12

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(rawKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    fromBase64Url(rawKeyB64) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function generateKeyB64(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )
  const raw = await crypto.subtle.exportKey("raw", key)
  return toBase64Url(new Uint8Array(raw))
}

/** Returns iv || ciphertext. */
export async function encryptData(
  data: ArrayBuffer,
  rawKeyB64: string
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await importKey(rawKeyB64)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)
  )
  const out = new Uint8Array(IV_LENGTH + ciphertext.length)
  out.set(iv, 0)
  out.set(ciphertext, IV_LENGTH)
  return out
}

export async function decryptData(
  data: ArrayBuffer,
  rawKeyB64: string
): Promise<ArrayBuffer> {
  const all = new Uint8Array(data)
  if (all.length <= IV_LENGTH) throw new Error("ciphertext too short")
  const iv = all.slice(0, IV_LENGTH)
  const ciphertext = all.slice(IV_LENGTH)
  const key = await importKey(rawKeyB64)
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext as BufferSource)
}
