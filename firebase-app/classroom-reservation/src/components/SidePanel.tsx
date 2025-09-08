// リファクタリング版サイドパネルコンポーネント - 予約作成・表示用
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { UserSection } from './UserSection';
import { ReservationForm } from './ReservationForm';
import SimpleLogin from './SimpleLogin';
import { useReservationData } from '../hooks/useReservationData';
import { useAuth } from '../hooks/useAuth';
import { useReservationForm } from '../hooks/useReservationForm';
import { useConflictDetection } from '../hooks/useConflictDetection';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { validateDatesWithinMax } from '../utils/dateValidation';
import { reservationsService } from '../firebase/firestore';
import './SidePanel.css';
import { displayLabel } from '../utils/periodLabel';
import { formatPeriodDisplay } from '../utils/periodLabel';
import ReservationLimitSettings from './admin/ReservationLimitSettings';
import { authService } from '../firebase/auth';
import RecurringTemplatesModal from './admin/RecurringTemplatesModal';
import { APP_VERSION } from '../version';


interface SidePanelProps {
  selectedDate?: string;
  selectedEventId?: string;
  onClose?: () => void;
  onReservationCreated?: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  selectedDate,
  selectedEventId,
  onClose,
  onReservationCreated
}) => {
  // カスタムフックで状態管理を分離
  const { currentUser, showLoginModal, setShowLoginModal, handleLoginSuccess, handleLogout } = useAuth();
  const { rooms, reservations, slots } = useReservationData(currentUser, selectedDate);
  const roomOptions = useMemo(() =>
    rooms.filter(r => !!r.id).map(r => ({ id: r.id as string, name: r.name })),
  [rooms]);
  const [showTemplates, setShowTemplates] = useState(false);
  // 直後の重複チェックを抑止するためのクールダウン時刻
  const skipCheckUntilRef = useRef<number>(0);
  // 予約作成後に重複警告をクリアするため、コールバックをラップ
  const wrappedOnReservationCreated = () => {
    // 予約直後は一時的に重複チェックをスキップ（反映待ちの誤検知対策）
    skipCheckUntilRef.current = Date.now() + 2000; // 約2.0秒
    try { resetConflict(); } catch {}
    try { onReservationCreated && onReservationCreated(); } catch {}
  };
  const formHook = useReservationForm(selectedDate, currentUser, rooms, wrappedOnReservationCreated);
  const { conflictCheck, performConflictCheck, resetConflict } = useConflictDetection();
  const { maxDateStr, limitMonths } = useSystemSettings();
  // 予約作成: 先日付制限の検証を噛ませる
  const handleCreateWithLimit = async () => {
    const dates = formHook.getReservationDates();
    const result = validateDatesWithinMax(dates, maxDateStr);
    if (!result.ok) {
      const msg = `設定した日付（${maxDateStr}）までしか予約できません。無効な日付: ${result.firstInvalid}`;
      alert(msg);
      return;
    }
    await formHook.handleCreateReservation();
  };

  
  // 必要な値/関数だけ分解（useEffect依存の安定化）
  const { showForm, formData, getReservationDates, getReservationPeriods } = formHook;
  const { selectedRoom } = formData;
  
  // 管理者機能の表示状態（簡素化）
  const [csvMessage, setCsvMessage] = useState('');

  
  // 管理者権限チェック（共通ロジックに統一）
  const isAdmin = authService.isAdmin();

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
  const handleNormalizeExisting = async () => {};

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
        <h3>📅 予約管理 <span style={{ marginLeft: 8, fontSize: '0.85em', color: '#666' }}>Ver {APP_VERSION}</span></h3>
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
            slots={slots}
            selectedDate={selectedDate}
            maxDateStr={maxDateStr}
            limitMonths={limitMonths}
          />

          {/* 管理者機能セクション */}
          {isAdmin && (
            <div className="admin-section">
              <h4>🔧 管理者機能</h4>
              {csvMessage && (
                <div className={`csv-message ${csvMessage.includes('❌') ? 'error' : 'success'}`}>
                  {csvMessage}
                </div>
              )}
              {/* 予約制限設定 */}
              <ReservationLimitSettings currentUserId={currentUser?.uid} />
              <div className="admin-actions-row">
                <button className="admin-btn" onClick={() => setShowTemplates(true)}>固定予約テンプレートを開く</button>
                <RecurringTemplatesModal 
                  open={showTemplates}
                  onClose={() => setShowTemplates(false)}
                  isAdmin={isAdmin}
                  currentUserId={currentUser?.uid}
                  roomOptions={roomOptions}
                />
              </div>

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




    </div>
  );
};

export default SidePanel;
