import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';
import { Reservation } from '../../firebase/firestore';
import { parkingReservationsService } from '../../firebase/parking';
import { formatPeriodDisplay } from '../../utils/periodLabel';
import { useParkingReservations } from '../../contexts/ParkingReservationsContext';
import '../ReservationModal.css';

interface Props {
  open: boolean;
  reservationId: string | null;
  canDelete: (createdBy?: string) => boolean;
  canEdit: boolean;
  onClose: () => void;
}

export const ParkingDetailModal: React.FC<Props> = ({
  open,
  reservationId,
  canDelete,
  canEdit,
  onClose
}) => {
  const { refetch, removeReservation, updateReservation } = useParkingReservations();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'full' | 'partial' | null>(null);
  const [selectedPeriodsToDelete, setSelectedPeriodsToDelete] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editReservationName, setEditReservationName] = useState('');
  const confirmDeleteBtnRef = useRef<HTMLButtonElement | null>(null);

  const loadReservation = useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    setError('');
    try {
      const data = await parkingReservationsService.getReservationById(reservationId);
      if (data) {
        setReservation(data);
        setEditTitle(data.title || '');
        setEditReservationName(data.reservationName || '');
      } else {
        setError('予約が見つかりません');
      }
    } catch {
      setError('予約データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    if (open && reservationId) {
      loadReservation();
    } else if (!open) {
      setReservation(null);
      setError('');
      setShowDeleteConfirm(false);
      setDeleteMode(null);
      setSelectedPeriodsToDelete(new Set());
      setIsEditing(false);
    }
  }, [open, reservationId, loadReservation]);

  useEffect(() => {
    if (showDeleteConfirm && confirmDeleteBtnRef.current) {
      confirmDeleteBtnRef.current.focus();
    }
  }, [showDeleteConfirm]);

  if (!open) return null;

  const getPeriods = (r: Reservation | null): string[] => {
    if (!r?.period) return [];
    return r.period.includes(',') ? r.period.split(',').map(p => p.trim()).filter(Boolean) : [r.period];
  };
  const isMulti = getPeriods(reservation).length > 1;

  const formatDate = (timestamp: Timestamp): string => {
    const d = timestamp.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${y}/${m}/${dd} (${w})`;
  };

  const allowDelete = reservation ? canDelete(reservation.createdBy) : false;

  const handleDelete = async () => {
    if (!reservation?.id) return;
    try {
      setLoading(true);
      if (deleteMode === 'partial' && selectedPeriodsToDelete.size > 0) {
        const periodsToDelete = Array.from(selectedPeriodsToDelete);
        await parkingReservationsService.deletePartialPeriods(reservation.id, periodsToDelete);
        const remaining = getPeriods(reservation).length - periodsToDelete.length;
        if (remaining <= 0) removeReservation(String(reservation.id));
        window.dispatchEvent(new CustomEvent('parking:changed', {
          detail: { type: remaining <= 0 ? 'deleted' : 'updated', id: String(reservation.id) }
        }));
        toast.success(`${periodsToDelete.length}時限を削除しました`);
      } else {
        await parkingReservationsService.deleteReservation(reservation);
        removeReservation(String(reservation.id));
        window.dispatchEvent(new CustomEvent('parking:changed', {
          detail: { type: 'deleted', id: String(reservation.id) }
        }));
        toast.success('予約を削除しました');
      }
      try { await refetch(); } catch {}
      onClose();
    } catch {
      setError('予約の削除に失敗しました');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setDeleteMode(null);
      setSelectedPeriodsToDelete(new Set());
    }
  };

  const handleSave = async () => {
    if (!reservation?.id) return;
    try {
      setLoading(true);
      const updates = { title: editTitle.trim(), reservationName: editReservationName.trim() };
      await parkingReservationsService.updateReservation(String(reservation.id), updates);
      setReservation({ ...reservation, ...updates });
      updateReservation(String(reservation.id), updates);
      setIsEditing(false);
      toast.success('予約を更新しました');
    } catch {
      setError('予約の更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reservation-modal-overlay" onClick={onClose}>
      <div className="reservation-modal compact" onClick={e => e.stopPropagation()}>
        <div className="reservation-modal-header">
          <h2>駐車場予約の詳細</h2>
          <button className="close-button" onClick={onClose} disabled={loading}>✕</button>
        </div>
        <div className="reservation-modal-body">
          {loading && <div className="loading-message">読み込み中...</div>}
          {error && <div className="error-message">{error}</div>}
          {reservation && (
            <div className={`reservation-details ${isEditing ? 'is-editing' : ''}`}>
              <div className="detail-card">
                <span className="detail-label">日付</span>
                <span className="detail-value">{formatDate(reservation.startTime)}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">時限</span>
                <span className="detail-value">{formatPeriodDisplay(reservation.period, reservation.periodName)}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">駐車場</span>
                <span className="detail-value">{reservation.roomName}</span>
              </div>
              <div className={`detail-card detail-card--wide ${isEditing ? 'is-active' : ''}`}>
                <span className="detail-label">予約者</span>
                <span className="detail-value">
                  {!isEditing ? (
                    reservation.reservationName || '—'
                  ) : (
                    <input
                      type="text"
                      value={editReservationName}
                      onChange={e => setEditReservationName(e.target.value)}
                      disabled={loading}
                      maxLength={30}
                    />
                  )}
                </span>
              </div>
              <div className={`detail-card detail-card--wide ${isEditing ? 'is-active' : ''}`}>
                <span className="detail-label">予約内容</span>
                <span className="detail-value">
                  {!isEditing ? (
                    reservation.title || '—'
                  ) : (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      disabled={loading}
                      maxLength={40}
                    />
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className={`reservation-actions ${showDeleteConfirm ? 'confirm-mode' : ''}`}>
          {canEdit && reservation && !showDeleteConfirm && (
            !isEditing ? (
              <button className="edit-button" onClick={() => setIsEditing(true)} disabled={loading}>✏️ 編集</button>
            ) : (
              <div className="edit-inline">
                <button className="confirm-edit-btn" onClick={handleSave} disabled={loading}>保存</button>
                <button
                  className="cancel-edit-btn"
                  onClick={() => {
                    setIsEditing(false);
                    setEditTitle(reservation.title || '');
                    setEditReservationName(reservation.reservationName || '');
                  }}
                  disabled={loading}
                >
                  取消
                </button>
              </div>
            )
          )}
          {allowDelete && reservation && !showDeleteConfirm && (
            <button className="delete-button" onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
              🗑️ 予約を削除
            </button>
          )}
          {allowDelete && showDeleteConfirm && (
            <div className="delete-inline improved" role="alertdialog" aria-label="削除確認">
              {isMulti && deleteMode === null ? (
                <div className="delete-mode-selection">
                  <span className="confirm-text-strong">削除方法を選択してください</span>
                  <div className="delete-mode-buttons">
                    <button className="delete-mode-btn full" onClick={() => setDeleteMode('full')} disabled={loading}>全部削除</button>
                    <button className="delete-mode-btn partial" onClick={() => setDeleteMode('partial')} disabled={loading}>一部削除</button>
                    <button className="cancel-delete-btn" onClick={() => setShowDeleteConfirm(false)} disabled={loading}>キャンセル</button>
                  </div>
                </div>
              ) : isMulti && deleteMode === 'partial' ? (
                <div className="partial-delete-selection">
                  <span className="confirm-text-strong">削除する時限を選択してください</span>
                  <div>
                    {getPeriods(reservation).map(p => (
                      <label key={p} style={{ display: 'block', margin: '4px 0' }}>
                        <input
                          type="checkbox"
                          checked={selectedPeriodsToDelete.has(p)}
                          onChange={e => {
                            setSelectedPeriodsToDelete(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(p);
                              else next.delete(p);
                              return next;
                            });
                          }}
                        />{' '}
                        {formatPeriodDisplay(p)}
                      </label>
                    ))}
                  </div>
                  <div className="delete-mode-buttons">
                    <button
                      className="confirm-delete-btn"
                      onClick={handleDelete}
                      disabled={loading || selectedPeriodsToDelete.size === 0}
                      ref={confirmDeleteBtnRef}
                    >
                      削除する
                    </button>
                    <button className="cancel-delete-btn" onClick={() => { setDeleteMode(null); setSelectedPeriodsToDelete(new Set()); }} disabled={loading}>
                      戻る
                    </button>
                  </div>
                </div>
              ) : (
                <div className="delete-mode-selection">
                  <span className="confirm-text-strong">この予約を削除しますか？</span>
                  <div className="delete-mode-buttons">
                    <button className="confirm-delete-btn" onClick={handleDelete} disabled={loading} ref={confirmDeleteBtnRef}>
                      削除する
                    </button>
                    <button className="cancel-delete-btn" onClick={() => { setShowDeleteConfirm(false); setDeleteMode(null); }} disabled={loading}>
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParkingDetailModal;
