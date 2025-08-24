// 固定予約機能の型定義

// 優先度の定義
export type TemplatePriority = 'critical' | 'high' | 'normal';

// カテゴリの定義
export type TemplateCategory = 'regular_class' | 'club_activity' | 'committee' | 'special_class' | 'other';

// 学期の定義
export type Semester = 'spring' | 'summer' | 'fall' | 'winter';

// 拡張された週次テンプレート
export interface WeeklyTemplateExtended {
  id?: string;
  name: string;
  roomId: string;
  weekday: number;
  periods: (number | string)[];
  startDate: string;
  endDate?: string;
  createdBy: string;
  createdAt?: any;
  updatedBy?: string;
  updatedAt?: any;
  enabled: boolean;
  priority?: TemplatePriority;
  category?: TemplateCategory;
  description?: string;
  teacherName?: string;
  studentCount?: number;
  forceOverride?: boolean;
}

// 後方互換性のためのエイリアス
export type WeeklyTemplate = WeeklyTemplateExtended;

// バルクテンプレート
export interface BulkTemplate {
  id?: string;
  name: string;
  academicYear: number;
  semester: Semester;
  startDate: string;
  endDate: string;
  templates: WeeklyTemplateExtended[];
  status: 'draft' | 'active' | 'archived';
  createdBy: string;
  createdAt?: any;
  updatedBy?: string;
  updatedAt?: any;
  description?: string;
}

// 学期の日付情報
export interface SemesterDates {
  startDate: string;
  endDate: string;
  name: string;
  academicYear?: number;
  semester?: Semester;
}

// 競合情報
export interface ConflictInfo {
  date: string;
  roomId: string;
  roomName: string;
  period: string;
  periodName?: string;
  action?: string;
  existingReservation: any;
  template: WeeklyTemplateExtended;
  newLocation?: {
    roomId: string;
    roomName: string;
    period: string;
    periodName?: string;
  };
}

// バルク適用結果
export interface BulkApplyResult {
  success: boolean;
  applied: number;
  conflicts: ConflictInfo[];
  overridden: number;
  relocated: number;
  skipped: number;
  errors: string[];
  summary: {
    total: number;
    success: number;
    failed: number;
    warnings: number;
  };
}

// 競合解決オプション
export interface ConflictResolutionOptions {
  forceOverride?: boolean;
  notifyConflicts?: boolean;
  dryRun?: boolean;
}

// 競合解決結果
export interface ConflictResolutionResult {
  success: boolean;
  action: 'overridden' | 'relocated' | 'skipped' | 'notified';
  conflicts: ConflictInfo[];
  message?: string;
}

// 自動適用オプション
export interface AutoApplyOptions {
  forceOverride?: boolean;
  notifyConflicts?: boolean;
  dryRun?: boolean;
  priority?: TemplatePriority;
}

// 自動適用結果
export interface AutoApplyResult {
  success: boolean;
  applied: number;
  conflicts: ConflictInfo[];
  overridden: number;
  relocated: number;
  skipped: number;
  errors: string[];
  timestamp: Date;
  academicYear?: number;
  semester?: string;
  summary?: {
    total: number;
    success: number;
    failed: number;
    warnings: number;
  };
}
