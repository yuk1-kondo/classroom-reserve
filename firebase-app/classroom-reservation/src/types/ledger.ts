// 台帳ビュー関連の型定義

/**
 * 台帳セル用の予約データ
 */
export interface LedgerCellReservation {
  id: string;
  title: string;
  reservationName: string;
  period: string;
  roomId: string;
}

/**
 * 台帳セルのデータ
 */
export interface LedgerCell {
  roomId: string;
  period: string;
  reservations: LedgerCellReservation[];
}

/**
 * 台帳ビューのプロパティ
 */
export interface LedgerViewProps {
  date: string;
  filterMine?: boolean;
  onFilterMineChange?: (value: boolean) => void;
  onDateChange?: (dateStr: string) => void;
  onCellClick?: (roomId: string, period: string, date: string) => void;
  onReservationClick?: (reservationId: string) => void;
}

