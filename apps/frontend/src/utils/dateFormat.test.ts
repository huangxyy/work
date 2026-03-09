import { describe, it, expect } from 'vitest';
import { formatDateShort, formatDate } from './dateFormat';

describe('formatDateShort', () => {
  it('should format ISO string correctly', () => {
    const result = formatDateShort('2026-03-01T17:05:00.000Z');
    // Result depends on local timezone, but format should be YYYY.M.D.H:MM
    expect(result).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}\.\d{1,2}:\d{2}$/);
  });

  it('should return "--" for empty string', () => {
    expect(formatDateShort('')).toBe('--');
  });

  it('should return "--" for falsy input', () => {
    expect(formatDateShort(undefined as unknown as string)).toBe('--');
    expect(formatDateShort(null as unknown as string)).toBe('--');
  });

  it('should pad minutes to 2 digits', () => {
    const result = formatDateShort('2026-01-15T09:05:00.000Z');
    expect(result).toContain(':05');
  });
});

describe('formatDate', () => {
  it('should format Date object correctly', () => {
    const date = new Date('2026-03-01T17:05:00.000Z');
    const result = formatDate(date);
    expect(result).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}\.\d{1,2}:\d{2}$/);
  });

  it('should format ISO string correctly', () => {
    const result = formatDate('2026-03-01T17:05:00.000Z');
    expect(result).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}\.\d{1,2}:\d{2}$/);
  });

  it('should return "--" for null', () => {
    expect(formatDate(null)).toBe('--');
  });

  it('should return "--" for undefined', () => {
    expect(formatDate(undefined)).toBe('--');
  });

  it('should return "--" for empty string', () => {
    expect(formatDate('')).toBe('--');
  });
});
