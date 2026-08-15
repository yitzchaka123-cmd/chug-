const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface VersionedDataKey {
  version: number;
  keyBase64: string;
}

export interface EncryptedJsonEnvelope {
  v: 1;
  alg: "A256GCM";
  keyVersion: number;
  iv: string;
  ciphertext: string;
}

export type DataKeyInput = string | VersionedDataKey;
export type HashInput = string | Uint8Array | ArrayBuffer;

const AES_GCM_IV_BYTES = 12;
const AES_256_KEY_BYTES = 32;
const TOKEN_DOMAIN = "choir-token:v1:";

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(""));
}

function base64ToBytes(value: string, label = "base64 value"): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  if (
    normalized.length === 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(padded) ||
    padded.length % 4 !== 0
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  try {
    const binary = atob(padded);
    const result = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      result[index] = binary.charCodeAt(index);
    }
    return result;
  } catch {
    throw new Error(`Invalid ${label}.`);
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBytes(input: HashInput): Uint8Array {
  if (typeof input === "string") return textEncoder.encode(input);
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

/** Creates a URL-safe, cryptographically random token with no identifying data. */
export function randomOpaqueToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 128) {
    throw new Error("Token length must be an integer between 16 and 128 bytes.");
  }

  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/** Returns a lowercase SHA-256 digest for strings or byte arrays. */
export async function sha256Hex(input: HashInput): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(toBytes(input)));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Hashes a bearer token before persistence. CHOIR_TOKEN_SECRET is treated as an
 * opaque UTF-8 secret and should contain at least 32 bytes of entropy.
 */
export async function hashOpaqueToken(token: string, choirTokenSecret: string): Promise<string> {
  if (!token) throw new Error("Token is required.");
  if (!choirTokenSecret) throw new Error("CHOIR_TOKEN_SECRET is required.");

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(textEncoder.encode(choirTokenSecret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(textEncoder.encode(`${TOKEN_DOMAIN}${token}`)),
  );
  return bytesToHex(new Uint8Array(signature));
}

/** Compares strings or byte arrays without returning at the first mismatch. */
export function constantTimeEqual(
  left: string | Uint8Array,
  right: string | Uint8Array,
): boolean {
  const leftBytes = typeof left === "string" ? textEncoder.encode(left) : left;
  const rightBytes = typeof right === "string" ? textEncoder.encode(right) : right;
  const longest = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < longest; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

/**
 * Accepts either a raw base64 key (implicitly version 1) or `vN:<base64>`.
 * Keeping the key version in each ciphertext makes later key rotation explicit.
 */
export function parseVersionedDataKey(input: DataKeyInput): VersionedDataKey {
  if (typeof input !== "string") {
    validateKeyVersion(input.version);
    validateAesKey(input.keyBase64);
    return { version: input.version, keyBase64: input.keyBase64.trim() };
  }

  const trimmed = input.trim();
  const versioned = /^v(\d+):(.+)$/i.exec(trimmed);
  const version = versioned ? Number(versioned[1]) : 1;
  const keyBase64 = versioned ? versioned[2].trim() : trimmed;
  validateKeyVersion(version);
  validateAesKey(keyBase64);
  return { version, keyBase64 };
}

function validateKeyVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Data-key version must be a positive integer.");
  }
}

function validateAesKey(keyBase64: string): Uint8Array {
  const bytes = base64ToBytes(keyBase64, "CHOIR_DATA_KEY");
  if (bytes.length !== AES_256_KEY_BYTES) {
    throw new Error("CHOIR_DATA_KEY must decode to exactly 32 bytes.");
  }
  return bytes;
}

async function importAesKey(keyBase64: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(validateAesKey(keyBase64)),
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

function encryptionAad(version: number): Uint8Array {
  return textEncoder.encode(`choir-data:v1:key-${version}`);
}

/** Encrypts JSON as a self-describing, versioned AES-256-GCM envelope. */
export async function encryptJson(
  value: unknown,
  choirDataKey: DataKeyInput,
): Promise<string> {
  const dataKey = parseVersionedDataKey(choirDataKey);
  const key = await importAesKey(dataKey.keyBase64, "encrypt");
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);

  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Value cannot be represented as JSON.");
  const plaintext = textEncoder.encode(serialized);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(encryptionAad(dataKey.version)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(plaintext),
  );

  const envelope: EncryptedJsonEnvelope = {
    v: 1,
    alg: "A256GCM",
    keyVersion: dataKey.version,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

/** Decrypts data produced by encryptJson and verifies its key version and tag. */
export async function decryptJson<T>(
  serializedEnvelope: string | EncryptedJsonEnvelope,
  choirDataKey: DataKeyInput,
): Promise<T> {
  let envelope: EncryptedJsonEnvelope;
  try {
    envelope =
      typeof serializedEnvelope === "string"
        ? (JSON.parse(serializedEnvelope) as EncryptedJsonEnvelope)
        : serializedEnvelope;
  } catch {
    throw new Error("Encrypted data is not a valid JSON envelope.");
  }

  if (
    envelope?.v !== 1 ||
    envelope.alg !== "A256GCM" ||
    !Number.isSafeInteger(envelope.keyVersion) ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("Encrypted data envelope is invalid or unsupported.");
  }

  const dataKey = parseVersionedDataKey(choirDataKey);
  if (dataKey.version !== envelope.keyVersion) {
    throw new Error(`CHOIR_DATA_KEY v${envelope.keyVersion} is required to decrypt this value.`);
  }

  const iv = base64ToBytes(envelope.iv, "encryption IV");
  if (iv.length !== AES_GCM_IV_BYTES) throw new Error("Encrypted data IV is invalid.");
  const ciphertext = base64ToBytes(envelope.ciphertext, "ciphertext");
  const key = await importAesKey(dataKey.keyBase64, "decrypt");

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(encryptionAad(envelope.keyVersion)),
        tagLength: 128,
      },
      key,
      toArrayBuffer(ciphertext),
    );
    return JSON.parse(textDecoder.decode(plaintext)) as T;
  } catch {
    throw new Error("Encrypted data could not be authenticated or decrypted.");
  }
}
