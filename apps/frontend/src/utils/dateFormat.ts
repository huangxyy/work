/**
 * 格式化日期为 YYYY.M.D.H:MM 格式（统一时间格式）
 * @param isoString - ISO 8601 日期字符串
 * @returns 格式化后的日期字符串，如 "2026.3.1.17:05"
 */
export function formatDateShort(isoString: string): string {
  if (!isoString) return '--';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}.${month}.${day}.${hours}:${minutes}`;
}

/**
 * 格式化日期对象为 YYYY.M.D.H:MM 格式
 * @param date - Date 对象
 * @returns 格式化后的日期字符串，如 "2026.3.1.17:05"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${year}.${month}.${day}.${hours}:${minutes}`;
}
