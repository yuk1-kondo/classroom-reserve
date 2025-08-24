// Firestoreコレクション名の定数
export const COLLECTIONS = {
  ROOMS: 'rooms',
  RESERVATIONS: 'reservations',
  RESERVATION_SLOTS: 'reservation_slots',
  RECURRING_TEMPLATES: 'weekly_templates',
  SYSTEM_SETTINGS: 'system_settings',
} as const;

// スロットタイプの定数
export const SLOT_TYPES = {
  RESERVATION: 'reservation',
  TEMPLATE_LOCK: 'template-lock',
} as const;

// デフォルト値の定数
export const DEFAULTS = {
  TEMPLATE_PRIORITY: 'normal' as const,
  TEMPLATE_CATEGORY: 'other' as const,
  FORCE_OVERRIDE: false,
} as const; 
