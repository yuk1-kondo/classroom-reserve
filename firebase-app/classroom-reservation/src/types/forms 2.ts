// フォーム関連の型定義

/**
 * 予約フォームのデータ
 */
export interface ReservationFormData {
  selectedRoom: string;
  selectedPeriod: string;
  title: string;
  reservationName: string;
}

/**
 * 日付範囲の状態
 */
export interface DateRangeState {
  startDate: string;
  endDate: string;
}

/**
 * フィルター設定
 */
export interface FilterSettings {
  showMyReservationsOnly: boolean;
  selectedRoom?: string;
  selectedPeriod?: string;
  dateRange?: DateRangeState;
}

/**
 * CSV行データ
 */
export interface CsvRowData {
  date: string;
  room: string;
  period: string;
  title: string;
  owner: string;
}

/**
 * CSVプレビューアイテム
 */
export interface CsvPreviewItem extends CsvRowData {
  roomId?: string;
  roomName?: string;
  error?: string;
}

