import { Room } from '../firebase/firestore';

/**
 * 台帳・日別予約テーブル共通：教室列の並び（左→右）。
 * 右端の理科3室は一般ユーザーに非表示の想定のため、その左に図書を置く。
 */
export const LEDGER_ROOM_ORDER = [
  'サテライト',
  '会議室',
  '社会科教室',
  'グローバル教室①',
  'グローバル教室②',
  'LL教室',
  '小演習室1',
  '小演習室2',
  '小演習室3',
  '小演習室4',
  '小演習室5',
  '小演習室6',
  '大演習室1',
  '大演習室2',
  '大演習室3',
  '大演習室4',
  'モノラボ',
  '視聴覚教室',
  '多目的室',
  '図書室',
  '図書館',
  '生物実験室',
  '化学実験室',
  '物理実験室'
];

export function sortRoomsByLedgerOrder(rooms: Room[]): Room[] {
  const orderMap = new Map<string, number>();
  LEDGER_ROOM_ORDER.forEach((name, index) => orderMap.set(name, index));
  return [...rooms].sort((a, b) => {
    const aOrder = orderMap.has(a.name) ? orderMap.get(a.name)! : Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.has(b.name) ? orderMap.get(b.name)! : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name, 'ja');
  });
}
