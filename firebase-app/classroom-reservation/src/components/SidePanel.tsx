// リファクタリング版サイドパネルコンポーネント - 予約作成・表示用
import React, { useEffect, useState, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { UserSection } from './UserSection';
import { ReservationForm } from './ReservationForm';
import SimpleLogin from './SimpleLogin';
// import { useReservationData } from '../hooks/useReservationData';
import { useReservationDataContext } from '../contexts/ReservationDataContext';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { useAuth } from '../hooks/useAuth';
import { useReservationForm } from '../hooks/useReservationForm';
import { useConflictDetection } from '../hooks/useConflictDetection';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { validateDatesWithinMax } from '../utils/dateValidation';
// import { reservationsService } from '../firebase/firestore';
import './SidePanel.css';
// import { displayLabel } from '../utils/periodLabel';
// import { formatPeriodDisplay } from '../utils/periodLabel';
import ReservationLimitSettings from './admin/ReservationLimitSettings';
// import { authService } from '../firebase/auth';
// import { adminService } from '../firebase/admin';
import RecurringTemplatesModal from './admin/RecurringTemplatesModal';
import AdminUserManager from './admin/AdminUserManager';
import { APP_VERSION } from '../version';


interface SidePanelProps {
  selectedDate?: string;
  selectedEventId?: string;
  onClose?: () => void;
  onReservationCreated?: () => void;
  prefilledRoomId?: string;
  prefilledPeriod?: string;
  prefillVersion?: number | null;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  selectedDate,
  selectedEventId,
  onClose,
  onReservationCreated,
  prefilledRoomId,
  prefilledPeriod,
  prefillVersion
}) => {
  // カスタムフックで状態管理を分離
  const { currentUser, showLoginModal, setShowLoginModal, handleLoginSuccess, handleLogout, isAdmin, isSuperAdmin } = useAuth();
  const { rooms, reservations: reservationsFromDaily, addReservations: addReservationsToDaily } = useReservationDataContext();
  const { reservations: monthlyReservations, addReservations: addReservationsToMonthly } = useMonthlyReservations();
  const reservations = React.useMemo(()=>{
    if (Array.isArray(reservationsFromDaily) && reservationsFromDaily.length > 0) return reservationsFromDaily;
    return Array.isArray(monthlyReservations) ? monthlyReservations : [];
  }, [reservationsFromDaily, monthlyReservations]);
  const roomOptions = useMemo(() =>
    rooms.filter(r => !!r.id).map(r => ({ id: r.id as string, name: r.name })),
  [rooms]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdminManager, setShowAdminManager] = useState(false);
  // 直後の重複チェックを抑止するためのクールダウン時刻
  const skipCheckUntilRef = useRef<number>(0);
  // 予約作成後に重複警告をクリアするため、コールバックをラップ
  const wrappedOnReservationCreated = (createdReservations?: any[]) => {
    // 予約直後は一時的に重複チェックをスキップ（反映待ちの誤検知対策）
    skipCheckUntilRef.current = Date.now() + 2000; // 約2.0秒
    try { resetConflict(); } catch {}
    
    // 作成された予約をContextに追加（差分更新）
    if (createdReservations && createdReservations.length > 0) {
      console.log('🎉 予約作成完了。Contextに追加:', createdReservations.length, '件');
      addReservationsToDaily(createdReservations);
      addReservationsToMonthly(createdReservations);
    }
    
    try { onReservationCreated && onReservationCreated(); } catch {}
  };
  const formHook = useReservationForm(selectedDate, currentUser, rooms, wrappedOnReservationCreated);
  const lastPrefillVersionRef = useRef<number | null>(null);
  
  // 台帳ビューからの事前入力を反映
  useEffect(() => {
    if (!prefilledRoomId || !prefilledPeriod) return;
    if (prefillVersion && lastPrefillVersionRef.current === prefillVersion) {
      return;
    }
    formHook.updateFormData('selectedRoom', prefilledRoomId);
    formHook.updateFormData('selectedPeriod', prefilledPeriod);
    formHook.setShowForm(true);
    if (prefillVersion) {
      lastPrefillVersionRef.current = prefillVersion;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledRoomId, prefilledPeriod, prefillVersion]);
  
  // スロット取得は削除（予約データから直接競合チェック可能）
  const { conflictCheck, performConflictCheck, resetConflict } = useConflictDetection();
  const { maxDateStr, limitMonths } = useSystemSettings();
  // 予約作成: 先日付制限の検証を噛ませる
  const handleCreateWithLimit = async () => {
    const dates = formHook.getReservationDates();
    const result = validateDatesWithinMax(dates, maxDateStr);
    if (!result.ok) {
      const msg = `設定した日付（${maxDateStr}）までしか予約できません。無効な日付: ${result.firstInvalid}`;
      toast.error(msg, { duration: 4000 });
      return;
    }
    await formHook.handleCreateReservation();
  };

  
  // 必要な値/関数だけ分解（useEffect依存の安定化）
  const { showForm, formData, getReservationDates, getReservationPeriods } = formHook;
  const { selectedRoom } = formData;
  
  // 管理者機能の表示状態（簡素化）
  // const [csvMessage, setCsvMessage] = useState(''); // 未使用のためコメントアウト（将来のCSV処理で再利用）
  // isSuperAdmin は useAuth から取得するように変更

  
  // 管理者権限チェック（共通ロジックに統一）
  // useAuth の isAdmin は「管理者として認識されているか」
  // さらに、最初の管理者（スーパー管理者）かを判定
  // 旧: ローカルで super 判定。新: useAuth 側に集約済み。

  // 使わない管理系アクションは撤去（必要時に再実装）

  // 重複チェックを実行するためのエフェクト
  useEffect(() => {
    if (showForm) {
      // クールダウン中はチェックしない
      if (Date.now() < skipCheckUntilRef.current) {
        return;
      }
      const timeoutId = setTimeout(() => {
        const datesToCheck = getReservationDates();
        const periodsToCheck = getReservationPeriods();
        
        if (datesToCheck.length > 0 && periodsToCheck.length > 0 && selectedRoom) {
          // 現在ユーザーIDを渡し、自己予約は「他ユーザー」扱いにならないようにする
          performConflictCheck(datesToCheck, periodsToCheck, selectedRoom, currentUser?.uid);
        }
      }, 300); // デバウンス: 300ms待ってからチェック実行
      
      return () => clearTimeout(timeoutId);
    }
  }, [showForm, selectedRoom, getReservationDates, getReservationPeriods, performConflictCheck, currentUser?.uid]);

  // 日付・教室変更で前回の重複結果をクリア
  useEffect(() => {
    resetConflict();
  }, [selectedDate, selectedRoom, resetConflict]);

  // ログインモーダル: ESCで閉じる
  useEffect(() => {
    if (!showLoginModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLoginModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLoginModal, setShowLoginModal]);

  // 日付フォーマット
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 予約ラベル正規化（既存データ再書込み）
  // const handleNormalizeExisting = async () => {};

  return (
    <div className="side-panel">
      <div className="only-mobile mobile-inline-close-wrapper">
        <button onClick={onClose} aria-label="閉じる" className="mobile-inline-close-btn">✕ 閉じる</button>
      </div>
      {/* ユーザー情報セクション */}
      <UserSection
        currentUser={currentUser}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      <div className="side-panel-header">
        <h3>📅 予約管理 <span className="app-version">Ver {APP_VERSION}</span></h3>
      </div>

      {selectedDate ? (
        <div className="side-panel-content">
          <div className="selected-date">
            <h4>{formatDate(selectedDate)}</h4>
          </div>

          {/* 予約作成フォーム */}
          <ReservationForm
            showForm={formHook.showForm}
            onShowForm={formHook.setShowForm}
            loading={formHook.loading}
            currentUser={currentUser}
            formData={formHook.formData}
            updateFormData={formHook.updateFormData}
            dateRange={formHook.dateRange}
            setDateRange={formHook.setDateRange}
            periodRange={formHook.periodRange}
            setPeriodRange={formHook.setPeriodRange}
            rooms={rooms}
            conflictCheck={conflictCheck}
            onCreateReservation={handleCreateWithLimit}
            reservations={reservations}
            selectedDate={selectedDate}
            maxDateStr={maxDateStr}
            limitMonths={limitMonths}
          />

          {/* 管理者機能セクション */}
          {isAdmin && (
            <div className="admin-section">
              <h4>🔧 管理者機能</h4>
              {/* CSV処理メッセージ（現在未使用） */}
              {/* 予約制限設定（全管理者が利用可能）*/}
              <ReservationLimitSettings currentUserId={currentUser?.uid} />
              {/* スーパー管理者専用ツール */}
              {isSuperAdmin && (
                <div className="admin-actions-row">
                  <button className="admin-btn" onClick={() => setShowTemplates(true)}>固定予約テンプレートを開く</button>
                  <button className="admin-btn" onClick={() => setShowAdminManager(true)}>管理者権限管理</button>
                  <RecurringTemplatesModal 
                    open={showTemplates}
                    onClose={() => setShowTemplates(false)}
                    isAdmin={isSuperAdmin}
                    currentUserId={currentUser?.uid}
                    roomOptions={roomOptions}
                  />
                </div>
              )}

              <div className="admin-functions" />
            </div>
          )}

          {/* 実用的な運用案内メッセージ */}
          <div className="info-message">
            <p>⚠️ 教室予約済みの場合は先生間で相談し変更して下さい</p>
          </div>
        </div>
      ) : (
        <div className="no-date-selected">
          <p>📅 カレンダーから日付をクリックして予約を管理してください</p>
        </div>
      )}
      
      {/* ログインモーダル */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SimpleLogin
              onAuthStateChange={handleLoginSuccess}
            />
            <button 
              className="modal-close-btn"
              onClick={() => setShowLoginModal(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 管理者管理モーダル */}
      {showAdminManager && (
        <div className="modal-overlay" onClick={() => setShowAdminManager(false)}>
          <div className="modal-content admin-manager-modal" onClick={(e) => e.stopPropagation()}>
            <AdminUserManager />
            <button 
              className="modal-close-btn"
              onClick={() => setShowAdminManager(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}




    </div>
  );
};

export default SidePanel;
