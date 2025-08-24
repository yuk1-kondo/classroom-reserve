// Firestoreコレクション名とその他の定数
export const COLLECTIONS = {
  ROOMS: 'rooms',
  RESERVATIONS: 'reservations',
  RESERVATION_SLOTS: 'reservation_slots',
  RECURRING_TEMPLATES: 'recurring_templates',
  SYSTEM_SETTINGS: 'system_settings',
  BULK_TEMPLATES: 'bulk_templates'
} as const;

// テンプレートロックのタイプ
export const SLOT_TYPES = {
  RESERVATION: 'reservation',
  TEMPLATE_LOCK: 'template-lock',
  SYSTEM_LOCK: 'system-lock'
} as const;

// 優先度の表示名
export const PRIORITY_LABELS = {
  critical: '最重要',
  high: '高',
  normal: '通常'
} as const;

// カテゴリの表示名
export const CATEGORY_LABELS = {
  regular_class: '定期授業',
  club_activity: '部活動',
  committee: '委員会',
  special_class: '特別授業',
  other: 'その他'
} as const;

// 学期の表示名
export const SEMESTER_LABELS = {
  spring: '前期',
  summer: '夏期',
  fall: '後期',
  winter: '冬期'
} as const;

// 学期の期間設定（日本の一般的な学校年度）
export const SEMESTER_PERIODS = {
  spring: { startMonth: 4, endMonth: 7, name: '前期' },
  summer: { startMonth: 8, endMonth: 8, name: '夏期' },
  fall: { startMonth: 9, endMonth: 12, name: '後期' },
  winter: { startMonth: 1, endMonth: 3, name: '冬期' }
} as const;

// 曜日の表示名
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// デフォルト値
export const DEFAULTS = {
  TEMPLATE_PRIORITY: 'normal' as const,
  TEMPLATE_CATEGORY: 'other' as const,
  FORCE_OVERRIDE: false,
  NOTIFY_CONFLICTS: true,
  DRY_RUN: false
} as const;
