/**
 * 格式化日期为 YYYY.M.D 格式
 * @param isoString - ISO 8601 日期字符串
 * @returns 格式化后的日期字符串，如 "2026.3.1"
 */
export function formatDateShort(isoString: string): string {
  if (!isoString) return '--';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}.${month}.${day}`;
}
