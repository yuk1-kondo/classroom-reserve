// 予約詳細・編集モーダルコンポーネント
import React, { useState, useEffect } from 'react';
import { reservationsService, Reservation, periodTimeMap } from '../firebase/firestore';
import { authService } from '../firebase/auth';
import { Timestamp } from 'firebase/firestore';
import './ReservationModal.css';

interface ReservationModalProps {
  isOpen: boolean;
  reservationId: string | null;
  onClose: () => void;
  onReservationUpdated?: () => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  reservationId,
  onClose,
  onReservationUpdated
}) => {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 予約データを取得
  useEffect(() => {
    if (isOpen && reservationId) {
      loadReservation();
    }
  }, [isOpen, reservationId]);

  const loadReservation = async () => {
    if (!reservationId) return;

    setLoading(true);
    setError('');
    
    try {
      const reservationData = await reservationsService.getReservationById(reservationId);
      if (reservationData) {
        setReservation(reservationData);
      } else {
        setError('予約が見つかりません');
      }
    } catch (error) {
      console.error('予約取得エラー:', error);
      setError('予約データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 期間表示を整形
  const formatPeriodDisplay = (period: string): string => {
    if (period.includes('-')) {
      const [start, end] = period.split('-');
      const startName = periodTimeMap[start as keyof typeof periodTimeMap]?.name || start;
      const endName = periodTimeMap[end as keyof typeof periodTimeMap]?.name || end;
      const startTime = periodTimeMap[start as keyof typeof periodTimeMap]?.start || '';
      const endTime = periodTimeMap[end as keyof typeof periodTimeMap]?.end || '';
      return `${startName}〜${endName} (${startTime} - ${endTime})`;
    }
    
    const periodInfo = periodTimeMap[period as keyof typeof periodTimeMap];
    if (periodInfo) {
      return `${periodInfo.name} (${periodInfo.start} - ${periodInfo.end})`;
    }
    return period;
  };

  // 日付フォーマット
  const formatDate = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 予約削除
  const handleDelete = async () => {
    if (!reservation?.id) return;

    try {
      setLoading(true);
      await reservationsService.deleteReservation(reservation.id);
      console.log('✅ 予約削除成功');
      
      if (onReservationUpdated) {
        onReservationUpdated();
      }
      
      onClose();
    } catch (error) {
      console.error('❌ 予約削除エラー:', error);
      setError('予約の削除に失敗しました');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const currentUser = authService.getCurrentUserExtended();
  const canEdit = authService.canEditReservation(reservation?.createdBy);
  const canDelete = authService.canDeleteReservation(reservation?.createdBy);

  if (!isOpen) return null;

  return (
    <div className="reservation-modal-overlay">
      <div className="reservation-modal">
        <div className="reservation-modal-header">
          <h2>� 予約詳細</h2>
          <button 
            className="close-button"
            onClick={onClose}
            disabled={loading}
            title="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="reservation-modal-body">
          {loading && (
            <div className="loading-message">
              読み込み中...
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {reservation && (
            <div className="reservation-details">
              <div className="detail-section">
                <div className="detail-row">
                  <label>教室名:</label>
                  <span className="highlight">{reservation.roomName}</span>
                </div>
                <div className="detail-row">
                  <label>予約名:</label>
                  <span className="highlight">{reservation.title}</span>
                </div>
                <div className="detail-row">
                  <label>予約者:</label>
                  <span className="highlight">{reservation.reservationName}</span>
                </div>
                <div className="detail-row">
                  <label>日付:</label>
                  <span className="date-display">{formatDate(reservation.startTime)}</span>
                </div>
                <div className="detail-row">
                  <label>時限:</label>
                  <span className="period-display">{formatPeriodDisplay(reservation.period)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 権限に応じたアクションボタン */}
          <div className="reservation-actions">
            {canDelete && (
              <button 
                className="delete-button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                🗑️ 予約を削除
              </button>
            )}
          </div>

          {/* 削除確認ダイアログ */}
          {showDeleteConfirm && (
            <div className="confirm-dialog">
              <p>この予約を削除しますか？</p>
              <div className="confirm-buttons">
                <button 
                  className="confirm-button"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  削除
                </button>
                <button 
                  className="cancel-button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReservationModal;
