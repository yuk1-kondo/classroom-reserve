// 日付範囲ユーティリティ（重複していた 00:00〜23:59:59 設定を一元化）

export function startOfDay(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : new Date(input);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function dayRange(dateStr: string): { start: Date; end: Date } {
  return { start: startOfDay(dateStr), end: endOfDay(dateStr) };
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
