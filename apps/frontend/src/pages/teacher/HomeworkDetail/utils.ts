import { isAxiosError } from 'axios';

export const resolveApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) {
    return fallback;
  }
  const rawMessage = (error.response?.data as { message?: string | string[] } | undefined)?.message;
  if (Array.isArray(rawMessage)) {
    return rawMessage.join('; ');
  }
  if (typeof rawMessage === 'string' && rawMessage.trim()) {
    return rawMessage;
  }
  return fallback;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => window.URL.revokeObjectURL(url), 200);
};

export const isImageFile = (file: { type?: string; name: string }): boolean => {
  if (file.type?.startsWith('image/')) {
    return true;
  }
  return /\.(png|jpe?g|webp|tif?f?)$/i.test(file.name);
};

export const validateUploadFiles = (
  rawFiles: File[],
  t: (key: string) => string,
  showWarning: (msg: string) => void,
): { imageFiles: File[]; zipFiles: File[]; valid: boolean } => {
  const zipFiles = rawFiles.filter((file) => file.name.toLowerCase().endsWith('.zip'));
  const imageFiles = rawFiles.filter(
    (file) => !file.name.toLowerCase().endsWith('.zip') && isImageFile(file),
  );
  const invalidFiles = rawFiles.filter(
    (file) => !file.name.toLowerCase().endsWith('.zip') && !isImageFile(file),
  );

  if (zipFiles.length > 1) {
    showWarning(t('teacher.batchUpload.onlyOneZip'));
    return { imageFiles, zipFiles, valid: false };
  }

  if (zipFiles.length && imageFiles.length) {
    showWarning(t('teacher.batchUpload.zipOrImagesOnly'));
    return { imageFiles, zipFiles, valid: false };
  }

  if (invalidFiles.length) {
    showWarning(t('teacher.batchUpload.invalidFile'));
    return { imageFiles, zipFiles, valid: false };
  }

  if (!zipFiles.length && imageFiles.length > 100) {
    showWarning(t('teacher.batchUpload.imageLimit'));
    return { imageFiles, zipFiles, valid: false };
  }

  return { imageFiles, zipFiles, valid: true };
};
