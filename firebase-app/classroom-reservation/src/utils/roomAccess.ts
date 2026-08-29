import { Room } from '../firebase/firestore';

/**
 * `scienceGroupOnly` の教室を誰が一覧に含めてよいか（クライアント側の二重チェック。Firestore ルールが主）。
 * 管理者・理科メンバー以外からは理科専用教室を除外する。
 */
export function filterScienceOnlyRoomsForViewer(
  rooms: Room[],
  viewer: { isAdmin: boolean; isScienceMember: boolean }
): Room[] {
  if (viewer.isAdmin || viewer.isScienceMember) return rooms;
  return rooms.filter(r => r.scienceGroupOnly !== true);
}
