// 一括テンプレート管理用のFirestoreサービス
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS } from '../constants/collections';
import { 
  BulkTemplate, 
  WeeklyTemplate, 
  Semester, 
  BulkApplyResult,
  ConflictInfo 
} from '../types/templates';
import { 
  calculateSemesterDates, 
  getCurrentAcademicInfo
} from '../utils/semesterUtils';
import { applyTemplateLocksWithPriority } from './templateLocks';
import { recurringTemplatesService } from './recurringTemplates';

const BULK_TEMPLATES_COLLECTION = COLLECTIONS.BULK_TEMPLATES;

export const bulkTemplatesService = {
  /**
   * 一括テンプレートの一覧を取得
   */
  async list(): Promise<BulkTemplate[]> {
    try {
      const snap = await getDocs(collection(db, BULK_TEMPLATES_COLLECTION));
      return snap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as BulkTemplate)
      }));
    } catch (error) {
      console.error('一括テンプレート一覧取得エラー:', error);
      throw error;
    }
  },

  /**
   * 年度・学期別に一括テンプレートを取得
   */
  async listByAcademicYear(
    academicYear: number,
    semester?: Semester
  ): Promise<BulkTemplate[]> {
    try {
      let q = query(
        collection(db, BULK_TEMPLATES_COLLECTION),
        where('academicYear', '==', academicYear),
        orderBy('semester', 'asc')
      );
      
      if (semester) {
        q = query(q, where('semester', '==', semester));
      }
      
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as BulkTemplate)
      }));
    } catch (error) {
      console.error('年度別一括テンプレート取得エラー:', error);
      throw error;
    }
  },

  /**
   * 一括テンプレートを作成・更新
   */
  async upsert(template: BulkTemplate): Promise<string> {
    try {
      const id = template.id || doc(collection(db, BULK_TEMPLATES_COLLECTION)).id;
      const now = serverTimestamp();
      const ref = doc(db, BULK_TEMPLATES_COLLECTION, id);
      const prev = await getDoc(ref);
      
      // undefined を除去するユーティリティ
      const sanitize = (obj: any) => Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
      );
      
      const payload = sanitize({
        ...template,
        id,
        updatedAt: now,
      });
      
      // 新規作成時のみ createdAt/createdBy を保持
      if (!prev.exists()) {
        (payload as any).createdAt = now;
        if (template.createdBy) (payload as any).createdBy = template.createdBy;
      }
      
      await setDoc(ref, payload as any, { merge: true });
      return id;
    } catch (error) {
      console.error('一括テンプレート保存エラー:', error);
      throw error;
    }
  },

  /**
   * 一括テンプレートを削除
   */
  async remove(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, BULK_TEMPLATES_COLLECTION, id));
    } catch (error) {
      console.error('一括テンプレート削除エラー:', error);
      throw error;
    }
  },

  /**
   * 一括テンプレートを取得
   */
  async getById(id: string): Promise<BulkTemplate | null> {
    try {
      const docSnap = await getDoc(doc(db, BULK_TEMPLATES_COLLECTION, id));
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...(docSnap.data() as BulkTemplate)
        };
      }
      return null;
    } catch (error) {
      console.error('一括テンプレート取得エラー:', error);
      throw error;
    }
  },

  /**
   * 年度初めの一括適用
   */
  async applyAcademicYear(
    academicYear: number,
    semester: Semester,
    options: {
      forceOverride?: boolean;
      notifyConflicts?: boolean;
      dryRun?: boolean;
      priority?: 'critical' | 'high' | 'normal';
    } = {}
  ): Promise<BulkApplyResult> {
    try {
      console.log(`🏫 ${academicYear}年度${semester}の一括適用開始`);
      
      // 1. 該当するテンプレートを取得
      const templates = await recurringTemplatesService.listEnabled();
      if (templates.length === 0) {
        return {
          success: true,
          applied: 0,
          conflicts: [],
          overridden: 0,
          relocated: 0,
          skipped: 0,
          errors: [],
          summary: { total: 0, success: 0, failed: 0, warnings: 0 }
        };
      }
      
      // 2. 期間を計算
      const semesterDates = calculateSemesterDates(semester, academicYear);
      
      // 3. 優先度順に適用
      const result = await bulkTemplatesService.applyTemplatesInRange(
        templates,
        semesterDates.startDate,
        semesterDates.endDate,
        options
      );
      
      console.log(`✅ ${academicYear}年度${semester}の一括適用完了:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ ${academicYear}年度${semester}の一括適用エラー:`, error);
      return {
        success: false,
        applied: 0,
        conflicts: [],
        overridden: 0,
        relocated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : '不明なエラー'],
        summary: { total: 0, success: 0, failed: 0, warnings: 0 }
      };
    }
  },

  /**
   * 学期ごとの一括適用
   */
  async applySemester(
    semester: Semester,
    academicYear: number,
    options: {
      forceOverride?: boolean;
      notifyConflicts?: boolean;
      dryRun?: boolean;
      priority?: 'critical' | 'high' | 'normal';
    } = {}
  ): Promise<BulkApplyResult> {
    return bulkTemplatesService.applyAcademicYear(academicYear, semester, options);
  },

  /**
   * 期間内のテンプレート適用
   */
  async applyTemplatesInRange(
    templates: WeeklyTemplate[],
    startDate: string,
    endDate: string,
    options: {
      forceOverride?: boolean;
      notifyConflicts?: boolean;
      dryRun?: boolean;
      priority?: 'critical' | 'high' | 'normal';
    } = {}
  ): Promise<BulkApplyResult> {
    try {
      // 優先度フィルターが指定されている場合は適用
      let filteredTemplates = templates;
      if (options.priority) {
        filteredTemplates = templates.filter(t => t.priority === options.priority);
      }
      
      if (filteredTemplates.length === 0) {
        return {
          success: true,
          applied: 0,
          conflicts: [],
          overridden: 0,
          relocated: 0,
          skipped: 0,
          errors: [],
          summary: { total: 0, success: 0, failed: 0, warnings: 0 }
        };
      }
      
      // テンプレートロックを適用
      const result = await applyTemplateLocksWithPriority(
        startDate,
        endDate,
        'system',
        {
          forceOverride: options.forceOverride,
          priority: options.priority,
          dryRun: options.dryRun
        }
      );
      
      // 結果を整形
      const conflicts: ConflictInfo[] = result.conflicts.map((conflict: any) => ({
        date: conflict.date || startDate,
        roomId: conflict.roomId || '',
        roomName: conflict.roomName || '',
        period: conflict.period || '',
        periodName: conflict.periodName || '',
        existingReservation: {
          id: conflict.existingReservation?.id || '',
          title: conflict.existingReservation?.title || '',
          reservationName: conflict.existingReservation?.reservationName || '',
          createdBy: conflict.existingReservation?.createdBy || ''
        },
        template: {
          id: conflict.template?.id || '',
          name: conflict.template?.name || '',
          roomId: conflict.template?.roomId || '',
          weekday: conflict.template?.weekday || 0,
          periods: conflict.template?.periods || [],
          startDate: conflict.template?.startDate || '',
          endDate: conflict.template?.endDate,
          enabled: conflict.template?.enabled !== false,
          priority: conflict.template?.priority || 'normal',
          category: conflict.template?.category || 'other',
          createdBy: conflict.template?.createdBy || '',
          description: conflict.template?.description,
          teacherName: conflict.template?.teacherName,
          studentCount: conflict.template?.studentCount,
          forceOverride: conflict.template?.forceOverride
        },
        action: conflict.action || 'skipped'
      }));
      
      const summary = {
        total: filteredTemplates.length,
        success: result.created,
        failed: result.skipped,
        warnings: conflicts.length
      };
      
      return {
        success: result.created > 0 || result.skipped === 0,
        applied: result.created,
        conflicts,
        overridden: result.overridden,
        relocated: result.relocated,
        skipped: result.skipped,
        errors: [],
        summary
      };
      
    } catch (error) {
      console.error('期間内テンプレート適用エラー:', error);
      return {
        success: false,
        applied: 0,
        conflicts: [],
        overridden: 0,
        relocated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : '不明なエラー'],
        summary: { total: 0, success: 0, failed: 0, warnings: 0 }
      };
    }
  },

  /**
   * 現在の年度・学期の一括適用
   */
  async applyCurrentSemester(options: {
    forceOverride?: boolean;
    notifyConflicts?: boolean;
    dryRun?: boolean;
    priority?: 'critical' | 'high' | 'normal';
  } = {}): Promise<BulkApplyResult> {
    const { academicYear, semester } = getCurrentAcademicInfo();
    return bulkTemplatesService.applySemester(semester, academicYear, options);
  },

  /**
   * 年度全体の一括適用
   */
  async applyFullAcademicYear(
    academicYear: number,
    options: {
      forceOverride?: boolean;
      notifyConflicts?: boolean;
      dryRun?: boolean;
      priority?: 'critical' | 'high' | 'normal';
    } = {}
  ): Promise<BulkApplyResult[]> {
    const semesters: Semester[] = ['spring', 'summer', 'fall', 'winter'];
    const results: BulkApplyResult[] = [];
    
    for (const semester of semesters) {
      try {
        const result = await bulkTemplatesService.applySemester(semester, academicYear, options);
        results.push(result);
      } catch (error) {
        console.error(`${academicYear}年度${semester}の適用エラー:`, error);
        results.push({
          success: false,
          applied: 0,
          conflicts: [],
          overridden: 0,
          relocated: 0,
          skipped: 0,
          errors: [error instanceof Error ? error.message : '不明なエラー'],
          summary: { total: 0, success: 0, failed: 0, warnings: 0 }
        });
      }
    }
    
    return results;
  },

  /**
   * 一括テンプレートの状態を更新
   */
  async updateStatus(
    id: string, 
    status: 'draft' | 'active' | 'archived',
    updatedBy: string
  ): Promise<void> {
    try {
      await bulkTemplatesService.upsert({
        id,
        status,
        updatedBy
      } as BulkTemplate);
    } catch (error) {
      console.error('一括テンプレート状態更新エラー:', error);
      throw error;
    }
  }
};
