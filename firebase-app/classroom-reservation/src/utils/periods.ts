// 時限定義と関連ユーティリティ（firestore からの直定義を分離）

export const PERIOD_ORDER = ['0', '1', '2', '3', '4', 'lunch', '5', '6', '7', 'after'] as const;
export type PeriodKey = typeof PERIOD_ORDER[number];

export const periodTimeMap: Record<PeriodKey, { start: string; end: string; name: string }> = {
  '0': { start: '07:30', end: '08:30', name: '0限' },
  '1': { start: '08:50', end: '09:40', name: '1限' },
  '2': { start: '09:50', end: '10:40', name: '2限' },
  '3': { start: '10:50', end: '11:40', name: '3限' },
  '4': { start: '11:50', end: '12:40', name: '4限' },
  'lunch': { start: '12:40', end: '13:25', name: '昼休み' },
  '5': { start: '13:25', end: '14:15', name: '5限' },
  '6': { start: '14:25', end: '15:15', name: '6限' },
  '7': { start: '15:25', end: '16:15', name: '7限' },
  'after': { start: '16:25', end: '18:00', name: '放課後' },
};

// 曜日依存の時刻テーブル（after 開始時刻を切り替える）
function getPeriodTimeMapForDate(dateStr: string): Record<PeriodKey, { start: string; end: string; name: string }> {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const dow = d.getDay(); // 0:Sun,1:Mon,...,6:Sat
    // デフォルト: 月/水/土/日は16:25、それ以外(火・木・金)は15:25
    const defaultStart = (dow === 1 || dow === 3 || dow === 0 || dow === 6) ? '16:25' : '15:25';
    return {
      ...periodTimeMap,
      after: { ...periodTimeMap.after, start: defaultStart }
    } as any;
  } catch {
    return periodTimeMap;
  }
}

export function createDateTimeFromPeriod(dateStr: string, period: string | number) {
  const key = String(period) as PeriodKey;
  const times = getPeriodTimeMapForDate(dateStr)[key];
  if (!times) return null;
  const startDateTime = new Date(`${dateStr}T${times.start}:00`);
  const endDateTime = new Date(`${dateStr}T${times.end}:00`);
  return { start: startDateTime, end: endDateTime, periodName: times.name };
}
