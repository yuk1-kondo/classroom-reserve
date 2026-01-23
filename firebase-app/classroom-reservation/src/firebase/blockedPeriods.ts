// 予約禁止期間の管理サービス
import { collection, doc, getDocs, addDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from './config';

const COLLECTION = 'blocked_periods';

export interface BlockedPeriod {
  id?: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  roomId?: string | null;    // nullなら全教室
  roomName?: string | null;  // 表示用
  reason?: string | null;    // 理由メモ
  createdBy: string;
  createdAt?: Timestamp;
}

export const blockedPeriodsService = {
  /**
   * 全ての禁止期間を取得
   */
  async getAll(): Promise<BlockedPeriod[]> {
    const q = query(collection(db, COLLECTION), orderBy('startDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlockedPeriod));
  },

  /**
   * 禁止期間を追加
   */
  async add(block: Omit<BlockedPeriod, 'id' | 'createdAt'>): Promise<string> {
    // Firestoreはundefinedを受け付けないので、明示的にデータを構築
    const data: Record<string, any> = {
      startDate: block.startDate,
      endDate: block.endDate,
      createdBy: block.createdBy,
      createdAt: Timestamp.now()
    };
    // オプションフィールドはnullまたは値がある場合のみ追加
    if (block.roomId !== undefined) data.roomId = block.roomId;
    if (block.roomName !== undefined) data.roomName = block.roomName;
    if (block.reason !== undefined) data.reason = block.reason;
    
    const docRef = await addDoc(collection(db, COLLECTION), data);
    return docRef.id;
  },

  /**
   * 禁止期間を削除
   */
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  /**
   * 指定日付・教室が禁止期間に該当するかチェック
   * @param dateStr 日付 (YYYY-MM-DD)
   * @param roomId 教室ID（省略可）
   * @returns 該当する禁止期間があればその情報、なければnull
   */
  async check(dateStr: string, roomId?: string): Promise<BlockedPeriod | null> {
    const all = await this.getAll();
    for (const block of all) {
      // 日付範囲チェック
      if (dateStr >= block.startDate && dateStr <= block.endDate) {
        // 全教室対象（roomIdがnullまたは空）or 指定教室が一致
        if (!block.roomId || block.roomId === roomId) {
          return block;
        }
      }
    }
    return null;
  },

  /**
   * 複数日付・教室のブロックチェック（予約フォーム用）
   * @param dates 日付配列
   * @param roomId 教室ID
   * @returns 該当する禁止期間があればその情報、なければnull
   */
  async checkMultiple(dates: string[], roomId?: string): Promise<BlockedPeriod | null> {
    const all = await this.getAll();
    for (const dateStr of dates) {
      for (const block of all) {
        if (dateStr >= block.startDate && dateStr <= block.endDate) {
          // 全教室対象（roomIdがnullまたは空）or 指定教室が一致
          if (!block.roomId || block.roomId === roomId) {
            return block;
          }
        }
      }
    }
    return null;
  }
};
