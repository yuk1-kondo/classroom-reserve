// 予約禁止期間の管理サービス
import { collection, doc, getDocs, addDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from './config';

const COLLECTION = 'blocked_periods';

export interface BlockedPeriod {
  id?: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  // v1 (後方互換): 単一教室
  roomId?: string | null;
  roomName?: string | null;
  // v2: 複数教室
  roomIds?: string[] | null;   // null=全教室、配列=指定教室のみ
  roomNames?: string[] | null; // 表示用
  periods?: string[] | null;   // null=全時限、配列=指定時限のみ
  reason?: string | null;
  createdBy: string;
  createdAt?: Timestamp;
}

/** ブロックルールが指定 roomId に該当するか判定（v1/v2 両対応） */
function matchesRoom(block: BlockedPeriod, roomId?: string): boolean {
  // v2: roomIds 配列がある場合
  if (block.roomIds && block.roomIds.length > 0) {
    return !roomId || block.roomIds.includes(roomId);
  }
  // v1: 旧フォーマット (roomId 単一)
  return !block.roomId || block.roomId === roomId;
}

/** 表示用: ブロックの教室ラベルを取得 */
export function getRoomLabel(block: BlockedPeriod): string {
  if (block.roomIds && block.roomIds.length > 0 && block.roomNames && block.roomNames.length > 0) {
    return block.roomNames.join(', ');
  }
  if (block.roomId && block.roomName) return block.roomName;
  return '全教室';
}

export const blockedPeriodsService = {
  async getAll(): Promise<BlockedPeriod[]> {
    const q = query(collection(db, COLLECTION), orderBy('startDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlockedPeriod));
  },

  async add(block: Omit<BlockedPeriod, 'id' | 'createdAt'>): Promise<string> {
    const data: Record<string, any> = {
      startDate: block.startDate,
      endDate: block.endDate,
      createdBy: block.createdBy,
      createdAt: Timestamp.now()
    };
    if (block.roomId !== undefined) data.roomId = block.roomId;
    if (block.roomName !== undefined) data.roomName = block.roomName;
    if (block.roomIds !== undefined) data.roomIds = block.roomIds;
    if (block.roomNames !== undefined) data.roomNames = block.roomNames;
    if (block.periods !== undefined) data.periods = block.periods;
    if (block.reason !== undefined) data.reason = block.reason;

    const docRef = await addDoc(collection(db, COLLECTION), data);
    return docRef.id;
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async check(dateStr: string, roomId?: string, period?: string): Promise<BlockedPeriod | null> {
    const all = await this.getAll();
    for (const block of all) {
      if (dateStr >= block.startDate && dateStr <= block.endDate) {
        if (matchesRoom(block, roomId)) {
          if (!block.periods || !period || block.periods.includes(period)) {
            return block;
          }
        }
      }
    }
    return null;
  },

  async checkMultiple(dates: string[], roomId?: string, periods?: string[]): Promise<BlockedPeriod | null> {
    const all = await this.getAll();
    for (const dateStr of dates) {
      for (const block of all) {
        if (dateStr >= block.startDate && dateStr <= block.endDate) {
          if (matchesRoom(block, roomId)) {
            if (!block.periods) {
              return block;
            }
            if (!periods || periods.length === 0) {
              continue;
            }
            if (periods.some(p => block.periods!.includes(p))) {
              return block;
            }
          }
        }
      }
    }
    return null;
  }
};
