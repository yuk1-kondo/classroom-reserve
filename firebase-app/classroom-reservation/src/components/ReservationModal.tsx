// 予約詳細・編集モーダルコンポーネント
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { authService } from '../firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { Timestamp } from 'firebase/firestore';
import './ReservationModal.css';
import { formatPeriodDisplay } from '../utils/periodLabel';

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
  // isSuperAdmin はUI制御に未使用のため削除
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const confirmDeleteBtnRef = useRef<HTMLButtonElement | null>(null);

  const loadReservation = useCallback(async () => {
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
  }, [reservationId]);

  // 予約データを取得
  useEffect(() => {
    if (isOpen && reservationId) {
      loadReservation();
    }
  }, [isOpen, reservationId, loadReservation]);

  // 表示は period から再構築（periodName は参考のみ）
  const periodDisplay = (r: Reservation): string => {
    return formatPeriodDisplay(r.period, r.periodName);
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

  // 仕様変更（要望に合わせて更新）:
  // - 管理者（super/regular 共通）は誰の予約でも削除可能
  // - 一般ユーザーは作成者本人のみ削除可能
  const { isAdmin } = useAuth();
  const isCreator = reservation?.createdBy && authService.getCurrentUser()?.uid === reservation?.createdBy;
  // 管理者は常に削除可能。一般ユーザーは作成者のみ。
  const canDelete = isAdmin || (isCreator === true);

  useEffect(() => {
    if (showDeleteConfirm && confirmDeleteBtnRef.current) {
      confirmDeleteBtnRef.current.focus();
    }
  }, [showDeleteConfirm]);

  if (!isOpen) return null;

  return (
    <div className="reservation-modal-overlay">
      <div className="reservation-modal compact">
        <div className="reservation-modal-header">
          <h2>予約詳細</h2>
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
            <div className="reservation-details details-grid">
              {/* 1行目: 日付 / 時限 */}
              <div className="detail-item">
                <div className="item-label">日付</div>
                <div className="item-value">{formatDate(reservation.startTime)}</div>
              </div>
              <div className="detail-item">
                <div className="item-label">時限</div>
                <div className="item-value">{periodDisplay(reservation)}</div>
              </div>
              {/* 2行目: 教室 / 予約者 */}
              <div className="detail-item">
                <div className="item-label">教室</div>
                <div className="item-value">{reservation.roomName}</div>
              </div>
              <div className="detail-item">
                <div className="item-label">予約者</div>
                <div className="item-value">{reservation.reservationName}</div>
              </div>
              {/* 3行目: 予約内容（全幅） */}
              <div className="detail-item span-2">
                <div className="item-label">予約内容</div>
                <div className="item-value">{reservation.title}</div>
              </div>
            </div>
          )}

          <div className={`reservation-actions ${showDeleteConfirm ? 'confirm-mode' : ''}`}>
            {canDelete && !showDeleteConfirm && (
              <button 
                className="delete-button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                🗑️ 予約を削除
              </button>
            )}

            {canDelete && showDeleteConfirm && (
              <div className="delete-inline improved" role="alertdialog" aria-label="削除確認">
                <div className="confirm-left">
                  <span className="confirm-text-strong">削除しますか？</span>
                  <span className="confirm-sub">取り消しはできません</span>
                </div>
                <div className="inline-buttons">
                  <button 
                    ref={confirmDeleteBtnRef}
                    className="confirm-delete-btn"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    確定
                  </button>
                  <button 
                    className="cancel-delete-btn"
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
    </div>
  );
};

export default ReservationModal;
