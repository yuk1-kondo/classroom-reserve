// 日付操作のユーティリティ関数

/**
 * 日付に日数を加算
 * @param date 基準日
 * @param days 加算する日数（負の値で減算）
 * @returns 新しいDate
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 日付文字列に日数を加算
 * @param dateStr YYYY-MM-DD形式の日付文字列
 * @param days 加算する日数（負の値で減算）
 * @returns YYYY-MM-DD形式の日付文字列
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const result = addDays(date, days);
  return toDateString(result);
}

/**
 * DateをYYYY-MM-DD形式の文字列に変換
 * @param date Date
 * @returns YYYY-MM-DD形式の文字列
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 今日の日付をYYYY-MM-DD形式で取得
 * @returns YYYY-MM-DD形式の文字列
 */
export function getTodayString(): string {
  return toDateString(new Date());
}

/**
 * 日付文字列が有効なYYYY-MM-DD形式かチェック
 * @param dateStr チェックする文字列
 * @returns 有効な形式ならtrue
 */
export function isValidDateString(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

