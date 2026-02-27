import { isValidImageBuffer, detectImageType } from './file-validator';

describe('File Validator', () => {
  describe('isValidImageBuffer', () => {
    it('should detect JPEG', () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect PNG', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect GIF87a', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect GIF89a', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect BMP', () => {
      const buf = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect TIFF (little-endian)', () => {
      const buf = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect TIFF (big-endian)', () => {
      const buf = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x00]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should detect valid WebP', () => {
      // RIFF....WEBP
      const buf = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]);
      expect(isValidImageBuffer(buf)).toBe(true);
    });

    it('should reject RIFF without WEBP tag', () => {
      const buf = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x41, 0x56, 0x49, 0x20,
      ]);
      expect(isValidImageBuffer(buf)).toBe(false);
    });

    it('should reject empty buffer', () => {
      expect(isValidImageBuffer(Buffer.alloc(0))).toBe(false);
    });

    it('should reject buffer shorter than 8 bytes', () => {
      expect(isValidImageBuffer(Buffer.from([0xff, 0xd8]))).toBe(false);
    });

    it('should reject random bytes', () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      expect(isValidImageBuffer(buf)).toBe(false);
    });

    it('should reject text content', () => {
      const buf = Buffer.from('Hello World This is a text file');
      expect(isValidImageBuffer(buf)).toBe(false);
    });

    it('should reject null-ish input', () => {
      expect(isValidImageBuffer(null as unknown as Buffer)).toBe(false);
      expect(isValidImageBuffer(undefined as unknown as Buffer)).toBe(false);
    });
  });

  describe('detectImageType', () => {
    it('should return jpg for JPEG', () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(detectImageType(buf)).toBe('jpg');
    });

    it('should return png for PNG', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectImageType(buf)).toBe('png');
    });

    it('should return gif for GIF', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
      expect(detectImageType(buf)).toBe('gif');
    });

    it('should return bmp for BMP', () => {
      const buf = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectImageType(buf)).toBe('bmp');
    });

    it('should return tiff for TIFF', () => {
      const buf = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectImageType(buf)).toBe('tiff');
    });

    it('should return webp for valid WebP', () => {
      const buf = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]);
      expect(detectImageType(buf)).toBe('webp');
    });

    it('should return null for unknown format', () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      expect(detectImageType(buf)).toBeNull();
    });

    it('should return null for empty buffer', () => {
      expect(detectImageType(Buffer.alloc(0))).toBeNull();
    });

    it('should return null for null input', () => {
      expect(detectImageType(null as unknown as Buffer)).toBeNull();
    });
  });
});
