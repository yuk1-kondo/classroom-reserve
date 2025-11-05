// 予約詳細・編集モーダルコンポーネント
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editReservationName, setEditReservationName] = useState('');

  const loadReservation = useCallback(async () => {
    if (!reservationId) return;

    setLoading(true);
    setError('');
    
    // タイムアウト設定（10秒）
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('データの読み込みがタイムアウトしました。再度お試しください。');
    }, 10000);
    
    try {
      const reservationData = await reservationsService.getReservationById(reservationId);
      clearTimeout(timeoutId); // 成功したらタイムアウトをキャンセル
      
      if (reservationData) {
        setReservation(reservationData);
        setEditTitle(reservationData.title || '');
        setEditReservationName(reservationData.reservationName || '');
      } else {
        setError('予約が見つかりません');
      }
    } catch (error) {
      clearTimeout(timeoutId); // エラー時もタイムアウトをキャンセル
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
    } else if (!isOpen) {
      // モーダルが閉じられた時に状態をリセット
      setReservation(null);
      setLoading(false);
      setError('');
      setShowDeleteConfirm(false);
      setIsEditing(false);
    }
  }, [isOpen, reservationId, loadReservation]);

  // 表示は period から再構築（periodName は参考のみ）
  const periodDisplay = (r: Reservation): string => {
    return formatPeriodDisplay(r.period, r.periodName);
  };

  // 日付フォーマット
  const formatDate = (timestamp: Timestamp): string => {
    const d = timestamp.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const w = ['日','月','火','水','木','金','土'][d.getDay()];
    // 1行で収まるコンパクト表記（年を含む）
    return `${y}/${m}/${dd} (${w})`;
  };

  // 予約削除
  const handleDelete = async () => {
    if (!reservation || !reservation.id) return;

    try {
      setLoading(true);
      // 読み取りクォータ節約：予約が読み込めている場合はゼロリード版を使用
      await reservationsService.deleteReservationWithKnown(reservation as Reservation);
      console.log('✅ 予約削除成功');
      
      toast.success('予約を削除しました');
      onClose();
      
      // リロードせずに、コールバックで親コンポーネントに通知（差分更新）
      if (onReservationUpdated) {
        onReservationUpdated();
      }
    } catch (error: any) {
      console.error('❌ 予約削除エラー:', error);
      const msg = (error && (error.message || error.code)) || '';
      if (/quota/i.test(String(msg)) || /resource-exhausted/i.test(String(msg))) {
        setError('通信が混雑しています。少し待ってから再度お試しください。');
      } else {
        setError('予約の削除に失敗しました');
      }
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // 予約更新（タイトル/予約者名）
  const handleSave = async () => {
    if (!reservation || !reservation.id) return;
    try {
      setLoading(true);
      const updates: Partial<Reservation> = {
        title: editTitle.trim(),
        reservationName: editReservationName.trim()
      } as any;
      await reservationsService.updateReservation(String(reservation.id), updates);
      // ローカル状態更新
      setReservation({ ...reservation, ...updates });
      setIsEditing(false);
      toast.success('予約を更新しました');
      
      // リロードせずに、コールバックで親コンポーネントに通知（差分更新）
      if (onReservationUpdated) {
        onReservationUpdated();
      }
    } catch (e) {
      console.error('予約更新エラー:', e);
      setError('予約の更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 仕様変更（要望に合わせて更新）:
  // - 管理者（super/regular 共通）は誰の予約でも削除可能
  // - 一般ユーザーは作成者本人のみ削除可能
  const { isAdmin } = useAuth();
  const isCreator = reservation?.createdBy && authService.getCurrentUser()?.uid === reservation?.createdBy;
  // 管理者は常に削除可能。一般ユーザーは作成者のみ。
  const canDelete = isAdmin || (isCreator === true);
  const canEdit = isAdmin || (isCreator === true);

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
                <div className="item-value">
                  {!isEditing ? (
                    reservation.reservationName
                  ) : (
                    <input
                      type="text"
                      value={editReservationName}
                      onChange={(e) => setEditReservationName(e.target.value)}
                      disabled={loading}
                      aria-label="予約者名を編集"
                      placeholder="予約者名"
                    />
                  )}
                </div>
              </div>
              {/* 3行目: 予約内容（全幅） */}
              <div className="detail-item span-2">
                <div className="item-label">予約内容</div>
                <div className="item-value">
                  {!isEditing ? (
                    reservation.title
                  ) : (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={loading}
                      aria-label="予約内容を編集"
                      placeholder="予約内容"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={`reservation-actions ${showDeleteConfirm ? 'confirm-mode' : ''}`}>
            {canEdit && !showDeleteConfirm && (
              !isEditing ? (
                <button 
                  className="edit-button"
                  onClick={() => setIsEditing(true)}
                  disabled={loading}
                >
                  ✏️ 編集
                </button>
              ) : (
                <div className="edit-inline">
                  <button 
                    className="confirm-edit-btn"
                    onClick={handleSave}
                    disabled={loading || (!editTitle.trim() && !editReservationName.trim())}
                  >
                    保存
                  </button>
                  <button 
                    className="cancel-edit-btn"
                    onClick={() => { setIsEditing(false); setEditTitle(reservation?.title || ''); setEditReservationName(reservation?.reservationName || ''); }}
                    disabled={loading}
                  >
                    取消
                  </button>
                </div>
              )
            )}
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
