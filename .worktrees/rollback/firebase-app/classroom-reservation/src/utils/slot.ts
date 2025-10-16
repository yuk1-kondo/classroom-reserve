// 予約スロット関連のユーティリティ

export function makeSlotId(roomId: string, dateStr: string, period: string | number): string {
  return `${roomId}_${dateStr}_${String(period)}`;
}
