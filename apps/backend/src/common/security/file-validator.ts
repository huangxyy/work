/**
 * Validates file content by checking magic bytes.
 * Prevents forged MIME types from bypassing upload filters.
 */

type MagicSignature = { ext: string; bytes: number[]; offset?: number };

const SIGNATURES: MagicSignature[] = [
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46], },
  { ext: 'bmp', bytes: [0x42, 0x4d] },
  { ext: 'tiff', bytes: [0x49, 0x49, 0x2a, 0x00] },
  { ext: 'tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] },
];

export function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) {
    return false;
  }

  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      // WebP needs an additional check: bytes 8-11 should be "WEBP"
      if (sig.ext === 'webp') {
        if (buffer.length >= 12) {
          const webpTag = buffer.slice(8, 12).toString('ascii');
          if (webpTag === 'WEBP') return true;
        }
        continue;
      }
      return true;
    }
  }

  return false;
}

export function detectImageType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 8) return null;

  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      if (sig.ext === 'webp' && buffer.length >= 12) {
        if (buffer.slice(8, 12).toString('ascii') !== 'WEBP') continue;
      }
      return sig.ext;
    }
  }

  return null;
}
