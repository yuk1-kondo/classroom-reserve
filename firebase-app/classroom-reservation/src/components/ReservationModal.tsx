// 予約詳細・編集モーダルコンポーネント
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { reservationsService, Reservation } from '../firebase/firestore';
import { authService } from '../firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { Timestamp } from 'firebase/firestore';
import './ReservationModal.css';
import { formatPeriodDisplay, displayLabel } from '../utils/periodLabel';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { systemSettingsService } from '../firebase/settings';
import { isPasscodeDeletableRoom } from '../utils/passcodeDeletableRooms';
import PasscodeModal from './PasscodeModal';

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
  const [deleteMode, setDeleteMode] = useState<'full' | 'partial' | null>(null);
  const [selectedPeriodsToDelete, setSelectedPeriodsToDelete] = useState<Set<string>>(new Set());
  const confirmDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editReservationName, setEditReservationName] = useState('');
  const { refetch, removeReservation } = useMonthlyReservations();
  
  // パスコード関連の状態
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [meetingRoomPasscode, setMeetingRoomPasscode] = useState<string | null>(null);
  const [passcodeLoading, setPasscodeLoading] = useState(true);

  // 会議室・図書館削除用パスコード（system_settings.meetingRoomDeletePasscode）を取得
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setPasscodeLoading(true);
        const settings = await systemSettingsService.get();
        if (!mounted) return;
        setMeetingRoomPasscode(settings?.meetingRoomDeletePasscode || null);
      } catch (e) {
        console.error('パスコード取得エラー:', e);
      } finally {
        if (mounted) setPasscodeLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
      setDeleteMode(null);
      setSelectedPeriodsToDelete(new Set());
      setIsEditing(false);
      setShowPasscodeModal(false);
    }
  }, [isOpen, reservationId, loadReservation]);

  // 複数時限予約かどうかを判定
  const isMultiPeriodReservation = (r: Reservation | null): boolean => {
    if (!r || !r.period) return false;
    const periods = r.period.includes(',') ? r.period.split(',').map(p => p.trim()).filter(Boolean) : [r.period];
    return periods.length > 1;
  };

  // 時限の配列を取得
  const getPeriods = (r: Reservation | null): string[] => {
    if (!r || !r.period) return [];
    return r.period.includes(',') ? r.period.split(',').map(p => p.trim()).filter(Boolean) : [r.period];
  };

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
      
      if (deleteMode === 'partial' && selectedPeriodsToDelete.size > 0) {
        // 一部削除
        const periodsToDelete = Array.from(selectedPeriodsToDelete);
        await reservationsService.deletePartialPeriods(reservation.id, periodsToDelete);
        console.log('✅ 一部削除成功');
        toast.success(`${periodsToDelete.length}時限を削除しました`);

        // 削除後に残りの時限があるかどうかを確認（簡易的判定）
        const currentPeriods = getPeriods(reservation);
        const remainingCount = currentPeriods.length - periodsToDelete.length;
        
        // 残りが0になる場合はローカルステートからも削除
        if (remainingCount <= 0) {
          removeReservation(String(reservation.id));
        }
        
        // イベント発行
        // 残りが0になる場合は deleted、残る場合は updated
        const eventType = remainingCount <= 0 ? 'deleted' : 'updated';
        window.dispatchEvent(new CustomEvent('reservation:changed', {
          detail: { type: eventType, id: String(reservation.id) }
        }));

      } else {
        // 全部削除
        await reservationsService.deleteReservationWithKnown(reservation as Reservation);
        console.log('✅ 予約削除成功');
        toast.success('予約を削除しました');
        
        // ローカルステートを即座に更新（キャッシュの問題を回避）
        removeReservation(String(reservation.id));
        
        window.dispatchEvent(new CustomEvent('reservation:changed', {
          detail: { type: 'deleted', id: String(reservation.id) }
        }));
      }
      
      // サーバーと同期（バックグラウンド）
      try { await refetch(); } catch {}
      
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
      setDeleteMode(null);
      setSelectedPeriodsToDelete(new Set());
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
  // - 管理者（super/regular 共通）は誰の予約でも削除・編集可能
  // - 一般ユーザーは作成者本人のみ削除可能（編集は不可）
  // - 会議室・図書館の場合、パスコードを知っている人も削除可能
  const { isAdmin } = useAuth();
  const currentUser = authService.getCurrentUser();
  const isCreator = reservation?.createdBy && currentUser?.uid === reservation?.createdBy;
  
  const passcodeRoom = isPasscodeDeletableRoom(reservation?.roomName);
  
  // パスコード削除が可能か（対象教室かつパスコードが設定されている）
  const canDeleteWithPasscode = !!currentUser && passcodeRoom && !!meetingRoomPasscode && !passcodeLoading;
  
  // 管理者は常に削除可能。一般ユーザーは作成者のみ。
  const canDeleteDirectly = isAdmin || (isCreator === true);
  
  // 削除可能（直接削除またはパスコード削除）
  const canDelete = canDeleteDirectly || canDeleteWithPasscode;
  
  // 編集は管理者のみ可能（一般ユーザーには編集ボタンを非表示）
  const canEdit = isAdmin;
  
  // パスコード削除が必要かどうか（直接削除できないが、パスコード削除は可能な場合）
  const needsPasscodeForDelete = !canDeleteDirectly && canDeleteWithPasscode;

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
            <div className={`reservation-details ${isEditing ? 'is-editing' : ''}`}>
              <div className="detail-card">
                <span className="detail-label">日付</span>
                <span className="detail-value">{formatDate(reservation.startTime)}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">時限</span>
                <span className="detail-value">{periodDisplay(reservation)}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">教室</span>
                <span className="detail-value">{reservation.roomName}</span>
              </div>
              <div className={`detail-card detail-card--wide detail-card--editable ${isEditing ? 'is-active' : ''}`}>
                <span className="detail-label">予約者</span>
                <span className="detail-value">
                  {!isEditing ? (
                    reservation.reservationName || '—'
                  ) : (
                    <input
                      type="text"
                      value={editReservationName}
                      onChange={(e) => setEditReservationName(e.target.value)}
                      disabled={loading}
                      aria-label="予約者名を編集"
                      placeholder="予約者名"
                      maxLength={30}
                    />
                  )}
                </span>
              </div>
              <div className={`detail-card detail-card--wide detail-card--editable ${isEditing ? 'is-active' : ''}`}>
                <span className="detail-label">予約内容</span>
                <span className="detail-value detail-value-multiline">
                  {!isEditing ? (
                    reservation.title || '—'
                  ) : (
                    <textarea
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={loading}
                      aria-label="予約内容を編集"
                      placeholder="予約内容"
                      maxLength={40}
                      rows={2}
                    />
                  )}
                </span>
              </div>
            </div>
          )}

          {reservation && isEditing && (
            <p className="edit-hint" role="status">
              編集モード：ハイライトされた項目が変更できます
            </p>
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
                onClick={() => {
                  if (needsPasscodeForDelete) {
                    // パスコードが必要な場合はパスコードモーダルを表示
                    setShowPasscodeModal(true);
                  } else {
                    // 直接削除可能な場合は確認画面を表示
                    setShowDeleteConfirm(true);
                  }
                }}
                disabled={loading}
              >
                🗑️ 予約を削除{needsPasscodeForDelete ? '（要パスコード）' : ''}
              </button>
            )}

            {canDelete && showDeleteConfirm && (
              <div className="delete-inline improved" role="alertdialog" aria-label="削除確認">
                {isMultiPeriodReservation(reservation) && deleteMode === null ? (
                  // 複数時限予約の場合：削除モードを選択
                  <div className="delete-mode-selection">
                    <div className="confirm-left">
                      <span className="confirm-text-strong">削除方法を選択してください</span>
                      <span className="confirm-sub">この予約は複数時限です</span>
                    </div>
                    <div className="delete-mode-buttons">
                      <button 
                        className="delete-mode-btn full"
                        onClick={() => setDeleteMode('full')}
                        disabled={loading}
                      >
                        全部削除
                      </button>
                      <button 
                        className="delete-mode-btn partial"
                        onClick={() => setDeleteMode('partial')}
                        disabled={loading}
                      >
                        一部削除
                      </button>
                      <button 
                        className="cancel-delete-btn"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteMode(null);
                        }}
                        disabled={loading}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : isMultiPeriodReservation(reservation) && deleteMode === 'partial' ? (
                  // 一部削除モード：時限を選択
                  <div className="partial-delete-selection">
                    <div className="confirm-left">
                      <span className="confirm-text-strong">削除する時限を選択してください</span>
                      <span className="confirm-sub">チェックした時限のみ削除されます</span>
                    </div>
                    <div className="period-checkboxes">
                      {getPeriods(reservation).map(period => (
                        <label key={period} className="period-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedPeriodsToDelete.has(period)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPeriodsToDelete);
                              if (e.target.checked) {
                                newSet.add(period);
                              } else {
                                newSet.delete(period);
                              }
                              setSelectedPeriodsToDelete(newSet);
                            }}
                            disabled={loading}
                          />
                          <span>{displayLabel(period)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="inline-buttons">
                      <button 
                        ref={confirmDeleteBtnRef}
                        className="confirm-delete-btn"
                        onClick={handleDelete}
                        disabled={loading || selectedPeriodsToDelete.size === 0}
                      >
                        確定 ({selectedPeriodsToDelete.size}時限削除)
                      </button>
                      <button 
                        className="cancel-delete-btn"
                        onClick={() => {
                          setDeleteMode(null);
                          setSelectedPeriodsToDelete(new Set());
                        }}
                        disabled={loading}
                      >
                        戻る
                      </button>
                    </div>
                  </div>
                ) : (
                  // 全部削除または単一時限予約の場合
                  <>
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
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteMode(null);
                        }}
                        disabled={loading}
                      >
                        キャンセル
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* パスコード入力モーダル */}
      <PasscodeModal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        onSuccess={() => {
          setShowPasscodeModal(false);
          setShowDeleteConfirm(true);
        }}
        correctPasscode={meetingRoomPasscode || ''}
        roomName={reservation?.roomName}
      />
    </div>
  );
};

export default ReservationModal;
