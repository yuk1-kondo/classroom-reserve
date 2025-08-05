// リファクタリング版サイドパネルコンポーネント - 予約作成・表示用
import React, { useEffect } from 'react';
import { reservationsService } from '../firebase/firestore';
import SimpleLogin from './SimpleLogin';
import { UserSection } from './UserSection';
import { ReservationForm } from './ReservationForm';
import { ReservationList } from './ReservationList';
import { useReservationData } from '../hooks/useReservationData';
import { useAuth } from '../hooks/useAuth';
import { useReservationForm } from '../hooks/useReservationForm';
import { useConflictDetection } from '../hooks/useConflictDetection';
import './SidePanel.css';

interface SidePanelProps {
  selectedDate?: string;
  selectedEventId?: string;
  onClose?: () => void;
  onReservationCreated?: () => void;
}

export const SidePanelRefactored: React.FC<SidePanelProps> = ({
  selectedDate,
  selectedEventId,
  onClose,
  onReservationCreated
}) => {
  // カスタムフックで状態管理を分離
  const { rooms, reservations, loading: dataLoading, loadReservationsForDate } = useReservationData(selectedDate);
  const { currentUser, showLoginModal, setShowLoginModal, handleLoginSuccess, handleLogout } = useAuth();
  const formHook = useReservationForm(selectedDate, currentUser, rooms, onReservationCreated);
  const { conflictCheck, performConflictCheck } = useConflictDetection();

  // 重複チェックを実行するためのエフェクト
  useEffect(() => {
    if (formHook.showForm) {
      const timeoutId = setTimeout(() => {
        const datesToCheck = formHook.getReservationDates();
        const periodsToCheck = formHook.getReservationPeriods();
        performConflictCheck(datesToCheck, periodsToCheck, formHook.formData.selectedRoom);
      }, 300); // デバウンス: 300ms待ってからチェック実行
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    formHook.showForm,
    formHook.formData.selectedRoom,
    formHook.dateRange,
    formHook.periodRange,
    formHook.formData.selectedPeriod,
    performConflictCheck,
    formHook.getReservationDates,
    formHook.getReservationPeriods
  ]);

  // 予約削除処理
  const handleDeleteReservation = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) {
      alert('予約が見つかりません');
      return;
    }

    if (!reservationsService || typeof reservationsService.deleteReservation !== 'function') {
      alert('予約削除機能が利用できません');
      return;
    }

    if (!window.confirm('この予約を削除しますか？')) {
      return;
    }

    try {
      await reservationsService.deleteReservation(reservationId);
      
      if (selectedDate) {
        await loadReservationsForDate(selectedDate);
      }
      
      if (onReservationCreated) {
        onReservationCreated();
      }
      
      alert('予約を削除しました');
    } catch (error) {
      console.error('予約削除エラー:', error);
      alert('予約の削除に失敗しました');
    }
  };

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

  return (
    <div className="side-panel">
      {/* ユーザー情報セクション */}
      <UserSection
        currentUser={currentUser}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      <div className="side-panel-header">
        <h3>📅 予約管理</h3>
        <div className="header-buttons">
          {onClose && (
            <button 
              className="close-button"
              onClick={onClose}
              disabled={dataLoading || formHook.loading}
            >
              ✕
            </button>
          )}
        </div>
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
            onCreateReservation={formHook.handleCreateReservation}
          />

          {/* 予約一覧 */}
          <ReservationList
            reservations={reservations}
            loading={dataLoading}
            onDeleteReservation={handleDeleteReservation}
          />
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

export default SidePanelRefactored;
