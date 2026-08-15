export const MAX_SIGNATURE_BYTES = 350 * 1024;
// Keep the complete multipart registration below Vercel's function request limit.
export const MAX_PAYMENT_PROOF_BYTES = 2_500_000;

export type AllowedImageMime = "image/png" | "image/jpeg" | "image/webp";
export type AllowedImageExtension = "png" | "jpg" | "webp";

export interface ValidatedImageUpload {
  bytes: Uint8Array;
  mimeType: AllowedImageMime;
  extension: AllowedImageExtension;
  size: number;
  fileName: string;
  metadata: {
    originalFilename: string;
    contentType: AllowedImageMime;
    byteLength: string;
  };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const SIGNATURE_MAX_DIMENSION = 4096;
const SIGNATURE_MAX_PIXELS = 8_388_608;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let value = "";
  for (let index = offset; index < offset + length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Signature image is not valid base64 data.");
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error("Signature image is not valid base64 data.");
  }
}

function assertSignaturePng(bytes: Uint8Array): void {
  if (!hasPrefix(bytes, PNG_SIGNATURE) || bytes.length < 45) {
    throw new Error("Signature must be a valid PNG image.");
  }

  let offset: number = PNG_SIGNATURE.length;
  let chunkCount = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("Signature PNG is truncated.");
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const chunkEnd = offset + 12 + length;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) {
      throw new Error("Signature PNG contains an invalid chunk.");
    }

    if (chunkCount === 0) {
      if (type !== "IHDR" || length !== 13) {
        throw new Error("Signature PNG header is invalid.");
      }
      const width = readUint32(bytes, offset + 8);
      const height = readUint32(bytes, offset + 12);
      if (
        width < 1 ||
        height < 1 ||
        width > SIGNATURE_MAX_DIMENSION ||
        height > SIGNATURE_MAX_DIMENSION ||
        width * height > SIGNATURE_MAX_PIXELS
      ) {
        throw new Error("Signature PNG dimensions are invalid or too large.");
      }
      sawHeader = true;
    } else if (type === "IHDR") {
      throw new Error("Signature PNG contains more than one header.");
    }

    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      if (length !== 0 || chunkEnd !== bytes.length) {
        throw new Error("Signature PNG ending is invalid.");
      }
      sawEnd = true;
      break;
    }

    offset = chunkEnd;
    chunkCount += 1;
    if (chunkCount > 10_000) throw new Error("Signature PNG contains too many chunks.");
  }

  if (!sawHeader || !sawImageData || !sawEnd) {
    throw new Error("Signature PNG is incomplete.");
  }
}

function detectImageType(bytes: Uint8Array): {
  mimeType: AllowedImageMime;
  extension: AllowedImageExtension;
} | null {
  if (hasPrefix(bytes, PNG_SIGNATURE)) return { mimeType: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

/**
 * Produces an ASCII-only basename safe for object metadata and downloads.
 * The detected image type, never the supplied extension, controls storage.
 */
export function normalizeUploadFilename(input: string | null | undefined, fallback = "upload"): string {
  const basename = (input || "").split(/[\\/]/).pop() || "";
  const normalized = basename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "-")
    .replace(/[ _-]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
  const safeFallback = fallback.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  return normalized || safeFallback;
}

function canonicalFilename(
  suppliedName: string | null | undefined,
  fallbackStem: string,
  extension: AllowedImageExtension,
): string {
  const normalized = normalizeUploadFilename(suppliedName, fallbackStem);
  const stem = normalized.replace(/\.[A-Za-z0-9]{1,10}$/i, "").slice(0, 75) || fallbackStem;
  return `${stem}.${extension}`;
}

function uploadResult(
  bytes: Uint8Array,
  detected: { mimeType: AllowedImageMime; extension: AllowedImageExtension },
  suppliedName: string | null | undefined,
  fallbackStem: string,
): ValidatedImageUpload {
  const fileName = canonicalFilename(suppliedName, fallbackStem, detected.extension);
  return {
    bytes,
    mimeType: detected.mimeType,
    extension: detected.extension,
    size: bytes.byteLength,
    fileName,
    metadata: {
      originalFilename: fileName,
      contentType: detected.mimeType,
      byteLength: String(bytes.byteLength),
    },
  };
}

/** Decodes a canvas-style PNG data URL and validates its size and PNG structure. */
export function decodeAndValidateSignatureDataUrl(dataUrl: string): ValidatedImageUpload {
  if (typeof dataUrl !== "string") throw new Error("Signature image is required.");
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Signature must be supplied as a PNG data URL.");

  // Reject oversized data before allocating the decoded buffer.
  if (match[1].replace(/\s/g, "").length > Math.ceil(MAX_SIGNATURE_BYTES / 3) * 4 + 4) {
    throw new Error("Signature image is larger than 350 KB.");
  }

  const bytes = decodeBase64(match[1]);
  if (bytes.byteLength === 0) throw new Error("Signature image is empty.");
  if (bytes.byteLength > MAX_SIGNATURE_BYTES) throw new Error("Signature image is larger than 350 KB.");
  assertSignaturePng(bytes);
  return uploadResult(bytes, { mimeType: "image/png", extension: "png" }, "signature.png", "signature");
}

/** Validates a privately stored payment proof by bytes, not client MIME or extension. */
export async function validatePaymentProofImage(
  file: Blob,
  suppliedFilename?: string | null,
): Promise<ValidatedImageUpload> {
  if (!file || typeof file.size !== "number" || typeof file.arrayBuffer !== "function") {
    throw new Error("Payment proof must be an uploaded file.");
  }
  if (file.size === 0) throw new Error("Payment proof image is empty.");
  if (file.size > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error("Payment proof image is larger than 2.5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error("Payment proof image size is invalid.");
  }

  const detected = detectImageType(bytes);
  if (!detected) throw new Error("Payment proof must be a PNG, JPEG, or WebP image.");

  const runtimeName =
    suppliedFilename ??
    ("name" in file && typeof (file as Blob & { name?: unknown }).name === "string"
      ? ((file as Blob & { name: string }).name)
      : null);
  return uploadResult(bytes, detected, runtimeName, "payment-proof");
}
