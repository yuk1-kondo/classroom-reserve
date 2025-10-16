// 日付バリデーションユーティリティ
export function isAfter(dateStr: string, boundStr?: string): boolean {
  if (!boundStr) return false;
  const x = new Date(dateStr);
  const b = new Date(boundStr);
  return x.getTime() > b.getTime();
}

export function clampToMax(dateStr: string, boundStr?: string): string {
  if (!boundStr) return dateStr;
  return isAfter(dateStr, boundStr) ? boundStr : dateStr;
}

export function validateDatesWithinMax(dates: string[], boundStr?: string): { ok: boolean; firstInvalid?: string } {
  if (!boundStr) return { ok: true };
  for (const d of dates) {
    if (isAfter(d, boundStr)) return { ok: false, firstInvalid: d };
  }
  return { ok: true };
}
