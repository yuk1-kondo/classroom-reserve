import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './config';

export type WeeklyTemplate = {
  id?: string;
  name: string; // 表示名
  roomId: string; // 教室ID
  weekday: number; // 0(日)〜6(土)
  periods: number[]; // コマ番号の配列（例: [1,2]）
  startDate: string; // yyyy-mm-dd（適用開始）
  endDate?: string; // yyyy-mm-dd（任意、適用終了）
  createdBy: string;
  createdAt?: any;
  updatedBy?: string;
  updatedAt?: any;
  enabled: boolean; // 有効/無効
};

const colRef = collection(db, 'recurring_templates');

export const recurringTemplatesService = {
  async list(): Promise<WeeklyTemplate[]> {
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as WeeklyTemplate) }));
  },
  async upsert(t: WeeklyTemplate): Promise<string> {
    const id = t.id || doc(colRef).id;
    const now = serverTimestamp();
    const ref = doc(colRef, id);
    const prev = await getDoc(ref);
    // undefined を除去するユーティリティ
    const sanitize = (obj: any) => Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    );
    const payload = sanitize({
      ...t,
      id,
      // endDate: undefined は保存しない
      updatedAt: now,
    });
    // 新規作成時のみ createdAt/createdBy を保持（既存は上書きしない）
    if (!prev.exists()) {
      (payload as any).createdAt = now;
      if (t.createdBy) (payload as any).createdBy = t.createdBy;
    }
    await setDoc(ref, payload as any, { merge: true });
    return id;
  },
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(colRef, id));
  },
};
