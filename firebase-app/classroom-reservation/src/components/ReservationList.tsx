// 予約一覧表示コンポーネント
import React from 'react';
import { Reservation, periodTimeMap } from '../firebase/firestore';
import { AuthUser } from '../firebase/auth';

interface ReservationListProps {
  reservations: Reservation[];
  loading: boolean;
  currentUser: AuthUser | null;
  onDeleteReservation: (reservationId: string) => void;
}

export const ReservationList: React.FC<ReservationListProps> = ({
  reservations,
  loading,
  currentUser,
  onDeleteReservation
}) => {
  // 削除権限をチェック
  const canDeleteReservation = (createdBy: string): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.uid === createdBy;
  };

  // 時限フォーマット - 複数時限対応
  const formatPeriod = (period: string): string => {
    // 複数時限の場合（カンマ区切り）
    if (period.includes(',')) {
      const periods = period.split(',');
      const startPeriod = periods[0];
      const endPeriod = periods[periods.length - 1];
      const startInfo = periodTimeMap[startPeriod as keyof typeof periodTimeMap];
      const endInfo = periodTimeMap[endPeriod as keyof typeof periodTimeMap];
      
      if (startInfo && endInfo) {
        return `${startInfo.name} - ${endInfo.name} (${startInfo.start} - ${endInfo.end})`;
      }
    }
    
    // 単一時限の場合
    const timeInfo = periodTimeMap[period as keyof typeof periodTimeMap];
    if (!timeInfo) return period;
    return `${timeInfo.name} (${timeInfo.start} - ${timeInfo.end})`;
  };

  return (
    <div className="reservations-section">
      <h5>📋 当日の予約一覧</h5>
      {loading ? (
        <div className="loading-message">読み込み中...</div>
      ) : reservations.length === 0 ? (
        <div className="no-reservations">この日に予約はありません</div>
      ) : (
        <div className="reservations-list">
          {reservations.map(reservation => (
            <div key={reservation.id} className="reservation-item">
              <div className="reservation-header">
                <span className="reservation-period">{formatPeriod(reservation.period)}</span>
                <span className="reservation-room">{reservation.roomName}</span>
              </div>
              <div className="reservation-title">{reservation.title}</div>
              <div className="reservation-details">
                <span className="reservation-name">予約者: {reservation.reservationName}</span>
                {reservation.createdBy && canDeleteReservation(reservation.createdBy) && (
                  <button 
                    className="delete-button"
                    onClick={() => onDeleteReservation(reservation.id!)}
                    disabled={loading}
                    title="予約を削除"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
