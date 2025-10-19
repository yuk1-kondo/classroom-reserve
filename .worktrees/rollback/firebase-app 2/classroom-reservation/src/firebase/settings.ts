// システム設定（予約制限など）を扱うサービス
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface SystemSettings {
  reservationLimitMonths?: number; // UI目安
  reservationMaxTimestamp?: Timestamp; // ルールでの強制に使用
  updatedBy?: string;
  updatedAt?: Timestamp;
}

const SETTINGS_COLLECTION = 'system_settings';
const GLOBAL_DOC_ID = 'global';

export const systemSettingsService = {
  async get(): Promise<SystemSettings | null> {
    const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as SystemSettings;
  },

  async upsert(settings: Partial<SystemSettings> & { updatedBy: string }): Promise<void> {
    const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
    const now = Timestamp.now();
    await setDoc(ref, { ...settings, updatedAt: now }, { merge: true });
  }
};

export function calcMaxDateFromMonths(months: number): Date {
  const today = new Date();
  const max = new Date(today);
  max.setHours(23, 59, 59, 999);
  max.setMonth(max.getMonth() + months);
  return max;
}
