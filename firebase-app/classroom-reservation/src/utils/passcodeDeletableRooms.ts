/**
 * 会議室・図書館など、共有パスコードで他者予約を削除できる教室かどうか。
 * roomName の表記ゆれに備え、部分一致で判定する。
 */
export function isPasscodeDeletableRoom(roomName: string | undefined | null): boolean {
  const name = String(roomName || '').replace(/\s+/g, '');
  return name.includes('会議室') || name.includes('図書館');
}
