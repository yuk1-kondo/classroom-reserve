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

export function createDateTimeFromPeriod(dateStr: string, period: string | number) {
  const key = String(period) as PeriodKey;
  const times = periodTimeMap[key];
  if (!times) return null;
  const startDateTime = new Date(`${dateStr}T${times.start}:00`);
  const endDateTime = new Date(`${dateStr}T${times.end}:00`);
  return { start: startDateTime, end: endDateTime, periodName: times.name };
}
