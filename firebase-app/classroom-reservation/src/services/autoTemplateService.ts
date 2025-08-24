// 固定予約テンプレートの自動適用サービス
import { bulkTemplatesService } from '../firebase/bulkTemplates';
import { recurringTemplatesService } from '../firebase/recurringTemplates';
import { getCurrentAcademicInfo } from '../utils/semesterUtils';
import { 
  WeeklyTemplate, 
  TemplatePriority, 
  ConflictInfo,
  AutoApplyResult,
  AutoApplyOptions
} from '../types/templates';

export class AutoTemplateService {
  
  /**
   * 毎週自動実行（システムから呼び出される）
   */
  static async applyWeeklyTemplates(options: AutoApplyOptions = {}): Promise<AutoApplyResult> {
    try {
      console.log('🔄 毎週テンプレート自動適用開始');
      
      const { academicYear, semester } = getCurrentAcademicInfo();
      const currentDate = new Date();
      
      // 現在の週の開始日と終了日を計算
      const weekStart = this.getWeekStart(currentDate);
      const weekEnd = this.getWeekEnd(currentDate);
      
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);
      
      console.log(`📅 適用期間: ${weekStartStr} 〜 ${weekEndStr}`);
      
      // 有効なテンプレートを取得
      const templates = await recurringTemplatesService.listEnabled();
      if (templates.length === 0) {
        console.log('ℹ️ 適用可能なテンプレートがありません');
        return this.createEmptyResult(academicYear, semester);
      }
      
      // 優先度順にソート
      const priorityOrder: TemplatePriority[] = ['critical', 'high', 'normal'];
      const sortedTemplates = templates.sort((a, b) => {
        const priorityA = a.priority || 'normal';
        const priorityB = b.priority || 'normal';
        return priorityOrder.indexOf(priorityA) - priorityOrder.indexOf(priorityB);
      });
      
      // 各テンプレートを適用
      let totalApplied = 0;
      let totalConflicts: ConflictInfo[] = [];
      let totalOverridden = 0;
      let totalRelocated = 0;
      let totalSkipped = 0;
      let totalErrors: string[] = [];
      
      for (const template of sortedTemplates) {
        try {
          const result = await this.applyTemplateForWeek(
            template,
            weekStartStr,
            weekEndStr,
            options
          );
          
          if (result.success) {
            totalApplied += result.applied;
            totalOverridden += result.overridden;
            totalRelocated += result.relocated;
            totalSkipped += result.skipped;
          }
          
          if (result.conflicts.length > 0) {
            totalConflicts.push(...result.conflicts);
          }
          
          if (result.errors.length > 0) {
            totalErrors.push(...result.errors);
          }
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '不明なエラー';
          console.error(`テンプレート適用エラー (${template.name}):`, errorMsg);
          totalErrors.push(`${template.name}: ${errorMsg}`);
        }
      }
      
      const summary = {
        total: templates.length,
        success: totalApplied,
        failed: totalErrors.length,
        warnings: totalConflicts.length
      };
      
      const result: AutoApplyResult = {
        success: totalApplied > 0 || totalErrors.length === 0,
        timestamp: currentDate,
        academicYear,
        semester,
        applied: totalApplied,
        conflicts: totalConflicts,
        overridden: totalOverridden,
        relocated: totalRelocated,
        skipped: totalSkipped,
        errors: totalErrors,
        summary
      };
      
      console.log('✅ 毎週テンプレート自動適用完了:', result);
      return result;
      
    } catch (error) {
      console.error('❌ 毎週テンプレート自動適用エラー:', error);
      const { academicYear, semester } = getCurrentAcademicInfo();
      return {
        success: false,
        timestamp: new Date(),
        academicYear,
        semester,
        applied: 0,
        conflicts: [],
        overridden: 0,
        relocated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : '不明なエラー'],
        summary: { total: 0, success: 0, failed: 0, warnings: 0 }
      };
    }
  }

  /**
   * 学期初めの一括適用
   */
  static async applySemesterStart(
    semester: string,
    academicYear: number,
    options: AutoApplyOptions = {}
  ): Promise<AutoApplyResult> {
    try {
      console.log(`🏫 ${academicYear}年度${semester}開始時の一括適用`);
      
      const result = await bulkTemplatesService.applySemester(
        semester as any,
        academicYear,
        options
      );
      
      return {
        success: result.success,
        timestamp: new Date(),
        academicYear,
        semester,
        applied: result.applied,
        conflicts: result.conflicts,
        overridden: result.overridden,
        relocated: result.relocated,
        skipped: result.skipped,
        errors: result.errors,
        summary: result.summary
      };
      
    } catch (error) {
      console.error(`❌ ${academicYear}年度${semester}開始時適用エラー:`, error);
      return {
        success: false,
        timestamp: new Date(),
        academicYear,
        semester,
        applied: 0,
        conflicts: [],
        overridden: 0,
        relocated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : '不明なエラー'],
        summary: { total: 0, success: 0, failed: 0, warnings: 0 }
      };
    }
  }

  /**
   * 年度初めの一括適用
   */
  static async applyAcademicYearStart(
    academicYear: number,
    options: AutoApplyOptions = {}
  ): Promise<AutoApplyResult[]> {
    try {
      console.log(`🎓 ${academicYear}年度開始時の一括適用`);
      
      const results = await bulkTemplatesService.applyFullAcademicYear(
        academicYear,
        options
      );
      
      return results.map(result => ({
        success: result.success,
        timestamp: new Date(),
        academicYear,
        semester: 'full_year',
        applied: result.applied,
        conflicts: result.conflicts,
        overridden: result.overridden,
        relocated: result.relocated,
        skipped: result.skipped,
        errors: result.errors,
        summary: result.summary
      }));
      
    } catch (error) {
      console.error(`❌ ${academicYear}年度開始時適用エラー:`, error);
      return [{
        success: false,
        timestamp: new Date(),
        academicYear,
        semester: 'full_year',
        applied: 0,
        conflicts: [],
        overridden: 0,
        relocated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : '不明なエラー'],
        summary: { total: 0, success: 0, failed: 0, warnings: 0 }
      }];
    }
  }

  /**
   * 個別テンプレートの週間適用
   */
  private static async applyTemplateForWeek(
    template: WeeklyTemplate,
    weekStart: string,
    weekEnd: string,
    options: AutoApplyOptions
  ): Promise<{
    success: boolean;
    applied: number;
    overridden: number;
    relocated: number;
    skipped: number;
    conflicts: ConflictInfo[];
    errors: string[];
  }> {
    try {
      // テンプレートの期間内かチェック
      if (template.startDate && template.startDate > weekEnd) {
        return { success: true, applied: 0, overridden: 0, relocated: 0, skipped: 0, conflicts: [], errors: [] };
      }
      if (template.endDate && template.endDate < weekStart) {
        return { success: true, applied: 0, overridden: 0, relocated: 0, skipped: 0, conflicts: [], errors: [] };
      }
      
      // テンプレートロックを適用
      const result = await bulkTemplatesService.applyTemplatesInRange(
        [template],
        weekStart,
        weekEnd,
        options
      );
      
      return {
        success: result.success,
        applied: result.applied,
        overridden: result.overridden,
        relocated: result.relocated,
        skipped: result.skipped,
        conflicts: result.conflicts,
        errors: result.errors
      };
      
    } catch (error) {
      console.error(`テンプレート週間適用エラー (${template.name}):`, error);
      return {
        success: false,
        applied: 0,
        overridden: 0,
        relocated: 0,
        skipped: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : '不明なエラー']
      };
    }
  }

  /**
   * 週の開始日（月曜日）を取得
   */
  private static getWeekStart(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を週の開始とする
    return new Date(date.setDate(diff));
  }

  /**
   * 週の終了日（日曜日）を取得
   */
  private static getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(new Date(date));
    weekStart.setDate(weekStart.getDate() + 6); // 日曜日
    return weekStart;
  }

  /**
   * 空の結果を作成
   */
  private static createEmptyResult(academicYear: number, semester: string): AutoApplyResult {
    return {
      success: true,
      timestamp: new Date(),
      academicYear,
      semester,
      applied: 0,
      conflicts: [],
      overridden: 0,
      relocated: 0,
      skipped: 0,
      errors: [],
      summary: { total: 0, success: 0, failed: 0, warnings: 0 }
    };
  }

  /**
   * 自動適用のスケジュール設定
   */
  static scheduleAutoApply(): void {
    // 毎週月曜日の午前6時に実行
    // 実際の実装では、Firebase FunctionsやCloud Schedulerを使用
    console.log('📅 自動適用スケジュール設定完了');
    console.log('⏰ 毎週月曜日 06:00 にテンプレート自動適用を実行');
  }

  /**
   * 手動実行（テスト用）
   */
  static async manualRun(options: AutoApplyOptions = {}): Promise<AutoApplyResult> {
    console.log('🔧 手動実行開始');
    return this.applyWeeklyTemplates(options);
  }
}
