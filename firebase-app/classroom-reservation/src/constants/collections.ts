// Firestoreコレクション名の定数
export const COLLECTIONS = {
  ROOMS: 'rooms',
  RESERVATIONS: 'reservations',
  RESERVATION_SLOTS: 'reservation_slots',
  RECURRING_TEMPLATES: 'weekly_templates',
  SYSTEM_SETTINGS: 'system_settings',
  /** 進路指導部など：先日付制限の特例メンバー（ドキュメントID=UID） */
  GUIDANCE_GROUP_MEMBERS: 'guidance_group_members',
  /** 理科グループ：実験室など `scienceGroupOnly` 教室の利用メンバー（ドキュメントID=UID） */
  SCIENCE_GROUP_MEMBERS: 'science_group_members',
  /** 駐車場枠マスタ（教室 rooms とは別コレクション） */
  PARKING_SPOTS: 'parking_spots',
  /** 駐車場予約本体 */
  PARKING_RESERVATIONS: 'parking_reservations',
  /** 駐車場の二重予約防止スロット */
  PARKING_SLOTS: 'parking_slots',
  /** 駐車場グループ（テスト利用・削除権限。ドキュメントID=UID） */
  PARKING_GROUP_MEMBERS: 'parking_group_members',
} as const;

/** system_settings 配下：会議室の roomId を保持（ルールとクライアントで共通） */
export const GUIDANCE_PRIVILEGE_DOC_ID = 'guidance_privilege';

/** system_settings 配下：駐車場の公開モード */
export const PARKING_SETTINGS_DOC_ID = 'parking';

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
