// メインアプリケーションコンポーネント
import React, { useState } from 'react';
import CalendarComponent from './CalendarComponent';
import SidePanel from './SidePanel';
import ReservationModal from './ReservationModal';
import DailyReservationTable from './DailyReservationTable';
import { useAuth } from '../hooks/useAuth';
import './MainApp.css';

export const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dailyTableDate, setDailyTableDate] = useState<string>(''); // 日別表示用の日付

  // 日付クリック処理
  const handleDateClick = (dateStr: string) => {
    if (!currentUser) {
      alert('予約機能を利用するにはログインが必要です');
      return;
    }
    console.log('📅 日付クリック:', dateStr);
    setSelectedDate(dateStr);
    setDailyTableDate(dateStr); // 日別表示テーブルも更新
    setSelectedEventId('');
    setShowSidePanel(true);
  };

  // イベントクリック処理
  const handleEventClick = (eventId: string) => {
    console.log('📅 イベントクリック:', eventId);
    setSelectedEventId(eventId);
    setShowReservationModal(true);
  };

  // サイドパネル閉じる
  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
    setSelectedDate('');
    setSelectedEventId('');
  };

  // 予約作成後の処理
  const handleReservationCreated = () => {
    // カレンダーを強制的に再読み込み
    setRefreshKey(prev => prev + 1);
    // 日別表示テーブルも更新
    if (dailyTableDate) {
      setDailyTableDate('');
      setTimeout(() => setDailyTableDate(selectedDate), 100);
    }
  };

  return (
    <div className="main-app">
      <header className="main-header">
        <h1>🌸 桜和高校教室予約システム</h1>
        <div className="header-info">
          <div className="system-info">v1.0</div>
          <button 
            className="toggle-panel-button"
            onClick={() => setShowSidePanel(!showSidePanel)}
          >
            {showSidePanel ? '📋 パネルを閉じる' : '📋 予約管理'}
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="calendar-section">
          <CalendarComponent
            key={refreshKey}
            refreshTrigger={refreshKey}
            selectedDate={selectedDate} // 選択日付を渡す
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
          />
          
          {/* 日別予約一覧テーブル */}
          {dailyTableDate && (
            <div className="daily-table-container">
              <DailyReservationTable 
                selectedDate={dailyTableDate}
              />
            </div>
          )}
        </div>

        {showSidePanel && (
          <aside className="side-panel-section">
            <SidePanel
              selectedDate={selectedDate}
              selectedEventId={selectedEventId}
              onClose={handleCloseSidePanel}
              onReservationCreated={handleReservationCreated}
            />
          </aside>
        )}
      </main>

      <footer className="main-footer">
        <p>© 2025 桜和高校教室予約システム (Owa-CBS) - Developed by YUKI KONDO</p>
      </footer>
      
      {/* 予約詳細モーダル */}
      <ReservationModal
        isOpen={showReservationModal}
        reservationId={selectedEventId}
        onClose={() => {
          setShowReservationModal(false);
          setSelectedEventId('');
        }}
        onReservationUpdated={handleReservationCreated}
      />
    </div>
  );
};

export default MainApp;
