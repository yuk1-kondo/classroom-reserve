import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS, DEFAULTS } from '../constants/collections';
import { WeeklyTemplateExtended, TemplatePriority, TemplateCategory } from '../types/templates';

// 既存のWeeklyTemplate型を新しい型に更新（後方互換性を保つ）
export type WeeklyTemplate = WeeklyTemplateExtended;

// Firestore接続テスト関数
export const testFirestoreConnection = async () => {
  try {
    console.log('🔍 Firestore接続テスト開始...');
    
    // システム設定の読み取りテスト
    const settingsRef = collection(db, 'system_settings');
    const settingsSnap = await getDocs(settingsRef);
    console.log('✅ システム設定読み取り成功:', settingsSnap.size, '件');
    
    // テンプレートコレクションの読み取りテスト
    const templateRef = collection(db, COLLECTIONS.RECURRING_TEMPLATES);
    const templateSnap = await getDocs(templateRef);
    console.log('✅ テンプレート読み取り成功:', templateSnap.size, '件');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore接続テスト失敗:', error);
    return false;
  }
};

// 既存のテンプレートデータを新しい型に変換するヘルパー
function migrateTemplateData(data: any): WeeklyTemplateExtended {
  return {
    ...data,
    // 新規フィールドのデフォルト値を設定
    priority: data.priority || DEFAULTS.TEMPLATE_PRIORITY,
    category: data.category || DEFAULTS.TEMPLATE_CATEGORY,
    forceOverride: data.forceOverride || DEFAULTS.FORCE_OVERRIDE,
    // 複数曜日選択のデフォルト値（既存データは単一曜日として扱う）
    weekdays: data.weekdays || (data.weekday !== undefined ? [data.weekday] : [1]),
    // 既存フィールドはそのまま保持
    id: data.id,
    name: data.name,
    roomId: data.roomId,
    weekday: data.weekday,
    periods: data.periods,
    startDate: data.startDate,
    endDate: data.endDate,
    createdBy: data.createdBy,
    createdAt: data.createdAt,
    updatedBy: data.updatedBy,
    updatedAt: data.updatedAt,
    enabled: data.enabled,
    description: data.description,
    teacherName: data.teacherName,
    studentCount: data.studentCount
  };
}

const colRef = collection(db, COLLECTIONS.RECURRING_TEMPLATES);

export const recurringTemplatesService = {
  async list(): Promise<WeeklyTemplate[]> {
    const snap = await getDocs(colRef);
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...migrateTemplateData(data)
      };
    });
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
    
    // 新規フィールドのデフォルト値を設定
    const templateData = {
      ...t,
      priority: t.priority || DEFAULTS.TEMPLATE_PRIORITY,
      category: t.category || DEFAULTS.TEMPLATE_CATEGORY,
      forceOverride: t.forceOverride || DEFAULTS.FORCE_OVERRIDE,
      // 複数曜日選択のデフォルト値
      weekdays: t.weekdays || (t.weekday !== undefined ? [t.weekday] : [1]),
    };
    
    const payload = sanitize({
      ...templateData,
      id,
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

  // 新規追加: 優先度別にテンプレートを取得
  async listByPriority(priority: TemplatePriority): Promise<WeeklyTemplate[]> {
    const allTemplates = await this.list();
    return allTemplates.filter(t => t.priority === priority);
  },

  // 新規追加: カテゴリ別にテンプレートを取得
  async listByCategory(category: TemplateCategory): Promise<WeeklyTemplate[]> {
    const allTemplates = await this.list();
    return allTemplates.filter(t => t.category === category);
  },

  // 新規追加: 有効なテンプレートのみを取得
  async listEnabled(): Promise<WeeklyTemplate[]> {
    const allTemplates = await this.list();
    return allTemplates.filter(t => t.enabled);
  },

  // 新規追加: 特定の教室のテンプレートを取得
  async listByRoom(roomId: string): Promise<WeeklyTemplate[]> {
    const allTemplates = await this.list();
    return allTemplates.filter(t => t.roomId === roomId);
  },

  // 新規追加: 特定の曜日のテンプレートを取得
  async listByWeekday(weekday: number): Promise<WeeklyTemplate[]> {
    const allTemplates = await this.list();
    return allTemplates.filter(t => t.weekday === weekday);
  }
};
