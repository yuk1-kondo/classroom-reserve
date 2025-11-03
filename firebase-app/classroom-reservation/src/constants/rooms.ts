// 教室関連の定数

/**
 * 台帳ビューでの教室の表示順序
 * この順序で教室が左から右に表示されます
 */
export const ROOM_DISPLAY_ORDER = [
  'サテライト',
  '会議室',
  '会議室（小）',
  '社会科教室',
  'グローバル教室①',
  'グローバル教室②',
  'LL教室',
  'モノラボ',
  '視聴覚教室',
  '多目的室',
  '大演習室1',
  '大演習室2',
  '大演習室3',
  '大演習室4',
  '小演習室1',
  '小演習室2',
  '小演習室3',
  '小演習室4',
  '小演習室5',
  '小演習室6'
] as const;

/**
 * 教室のカテゴリー分類
 * CSSクラス名の生成に使用
 */
export const ROOM_CATEGORIES = {
  SMALL_SEMINAR: /^小演習室/,
  LARGE_SEMINAR: /^大演習室/,
  PURPLE: /社会|LL|グローバル/,
  BLUE: /モノラボ|視聴覚|多目的/,
  RED: /サテライト|会議室/
} as const;

/**
 * 教室カテゴリーに対応するCSSクラス名
 */
export const ROOM_CATEGORY_CLASSES = {
  SMALL_SEMINAR: 'room-cat-small',
  LARGE_SEMINAR: 'room-cat-large',
  PURPLE: 'room-cat-purple',
  BLUE: 'room-cat-blue',
  RED: 'room-cat-red',
  DEFAULT: 'room-cat-default'
} as const;

