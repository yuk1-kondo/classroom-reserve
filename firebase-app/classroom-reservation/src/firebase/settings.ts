// システム設定（予約制限など）を扱うサービス
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface SystemSettings {
  reservationLimitMonths?: number; // UI目安
  reservationMaxTimestamp?: Timestamp; // ルールでの強制に使用
  updatedBy?: string;
  updatedAt?: Timestamp;
  // 曜日別の時刻/有効化ルール（任意）。JSの曜日番号 0(日)〜6(土)。
  weekdayRules?: {
    // after 開始時刻の上書き: { 1: '16:25', 3: '16:25', それ以外 '15:25' など }
    afterStartByDow?: Record<number, string>;
    // 7限を有効化する曜日: { 1: true, 3: true }
    enablePeriod7ByDow?: Record<number, boolean>;
  };
}

const SETTINGS_COLLECTION = 'system_settings';
const GLOBAL_DOC_ID = 'global';

export const systemSettingsService = {
  async get(): Promise<SystemSettings | null> {
    // セッション内TTLキャッシュ + 同時発火の重複排除
    const now = Date.now();
    const ttlMs = 5 * 60 * 1000; // 5分
    const g: any = systemSettingsService as any;
    if (g._cacheTime && (now - g._cacheTime) < ttlMs) {
      return (g._cache ?? null) as (SystemSettings | null);
    }
    if (g._inflight) {
      return await g._inflight;
    }
    const inflight: Promise<SystemSettings | null> = (async () => {
      const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
      const snap = await getDoc(ref);
      const data = snap.exists() ? (snap.data() as SystemSettings) : null;
      g._cache = data;
      g._cacheTime = Date.now();
      // settings snapshot publishing is optional; consumers may fetch via hook
      return data;
    })().finally(() => { (systemSettingsService as any)._inflight = null; });
    g._inflight = inflight;
    return await inflight;
  },

  async upsert(settings: Partial<SystemSettings> & { updatedBy: string }): Promise<void> {
    const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
    const now = Timestamp.now();
    await setDoc(ref, { ...settings, updatedAt: now }, { merge: true });
    // キャッシュを即時更新（読み取り削減とUI反映のため）
    try {
      const g: any = systemSettingsService as any;
      const prev = (g._cache ?? null) as (SystemSettings | null);
      const merged = prev ? ({ ...prev, ...settings, updatedAt: now } as SystemSettings) : ({ ...settings, updatedAt: now } as SystemSettings);
      g._cache = merged;
      g._cacheTime = Date.now();
      // settings snapshot publishing is optional; consumers may fetch via hook
    } catch {}
  }
};

export function calcMaxDateFromMonths(months: number): Date {
  const today = new Date();
  const max = new Date(today);
  max.setHours(23, 59, 59, 999);
  max.setMonth(max.getMonth() + months);
  return max;
}
