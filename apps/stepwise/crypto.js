export const legacyFormat = 'stepwise-encrypted-backup'
export const sponsorFormat = 'stepwise-sponsor-backup'
export const inventoryFormat = 'stepwise-private-inventory'
const iterations = 600000
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const aad = format => encoder.encode(format === legacyFormat
  ? 'Stepwise backup v1 | PBKDF2-SHA256 | 600000 | AES-256-GCM'
  : `${format} v1 | PBKDF2-SHA256 | 600000 | AES-256-GCM`)

function encode(bytes) {
  let text = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(text)
}

export function decode(text) {
  if (typeof text !== 'string' || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    throw new Error('Invalid base64 data.')
  }
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derive(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function newKey(passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: encode(salt), key: await derive(passphrase, salt) }
}

export function checkPassphrase(passphrase, confirmation) {
  if (passphrase.length < 12) throw new Error('Use at least 12 characters for the passphrase.')
  if (passphrase !== confirmation) throw new Error('The passphrases do not match.')
}

export async function seal(format, data, { key, salt }, max = 10 * 1048576) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify(data))
  if (plaintext.byteLength > max) throw new Error('This data exceeds the supported size.')
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(format) }, key, plaintext)
  return {
    format, version: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations,
    salt, iv: encode(iv), ciphertext: encode(new Uint8Array(encrypted)),
  }
}

export async function openEnvelope(envelope, formats, passphrase, max = 10 * 1048576) {
  if (!envelope || Object.keys(envelope).length !== 8 || !formats.includes(envelope.format)
      || envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM'
      || envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== iterations
      || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > Math.ceil((max + 16) / 3) * 4) {
    throw new Error('This file uses an unsupported backup format or size.')
  }
  let plaintext
  let key
  try {
    const salt = decode(envelope.salt)
    const iv = decode(envelope.iv)
    const ciphertext = decode(envelope.ciphertext)
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16 || ciphertext.length > max + 16) {
      throw new Error()
    }
    key = await derive(passphrase, salt)
    plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv, additionalData: aad(envelope.format),
    }, key, ciphertext)
  } catch {
    throw new Error('The passphrase is incorrect or the encrypted data is damaged.')
  }
  try {
    return { data: JSON.parse(decoder.decode(plaintext)), key, salt: envelope.salt }
  } catch {
    throw new Error('The decrypted data is invalid.')
  }
}

export async function readEnvelope(file, max = 14 * 1048576) {
  if (!file?.size || file.size > max) throw new Error('Select a backup within the supported size.')
  try {
    return JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not a readable encrypted backup.')
  }
}

export const backupFile = envelope => new Blob([JSON.stringify(envelope)], { type: 'application/octet-stream' })
