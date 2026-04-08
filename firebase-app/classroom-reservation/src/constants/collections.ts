// Firestoreコレクション名の定数
export const COLLECTIONS = {
  ROOMS: 'rooms',
  RESERVATIONS: 'reservations',
  RESERVATION_SLOTS: 'reservation_slots',
  RECURRING_TEMPLATES: 'weekly_templates',
  SYSTEM_SETTINGS: 'system_settings',
  /** 進路指導部など：先日付制限の特例メンバー（ドキュメントID=UID） */
  GUIDANCE_GROUP_MEMBERS: 'guidance_group_members',
} as const;

/** system_settings 配下：会議室の roomId を保持（ルールとクライアントで共通） */
export const GUIDANCE_PRIVILEGE_DOC_ID = 'guidance_privilege';

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
