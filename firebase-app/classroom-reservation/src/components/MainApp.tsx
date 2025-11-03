// メインアプリケーションコンポーネント
import React, { useCallback, useState } from 'react';
import CalendarComponent from './CalendarComponent';
import SidePanel from './SidePanel';
import ReservationModal from './ReservationModal';
import ReservationSheet from './ReservationSheet';
import { useAuth } from '../hooks/useAuth';
import './MainApp.css';
import { APP_VERSION } from '../version';
import { ReservationDataProvider } from '../contexts/ReservationDataContext';
import { MonthlyReservationsProvider } from '../contexts/MonthlyReservationsContext';

export const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dailyTableDate, setDailyTableDate] = useState<string>(''); // 日別表示用の日付
  const [showSheet, setShowSheet] = useState(false);
  const [filterMine, setFilterMine] = useState<boolean>(false);
  const [prefilledRoomId, setPrefilledRoomId] = useState<string>('');
  const [prefilledPeriod, setPrefilledPeriod] = useState<string>('');
  // プレビュー判定（クリーンパス/クエリ対応）
  const isPreview = (() => {
    if (typeof window === 'undefined') return false;
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('preview') === '1') return true;
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/preview' || path === '/ux-preview';
  })();

  // 日付クリック処理
  const handleDateNavigate = useCallback((dateStr: string) => {
    const normalized = dateStr;
    setSelectedDate(normalized);
    setDailyTableDate(normalized);
  }, []);

  const handleDateClick = (dateStr: string) => {
    if (!currentUser) {
      alert('予約機能を利用するにはログインが必要です');
      return;
    }
    console.log('📅 日付クリック:', dateStr);
    handleDateNavigate(dateStr);
    setSelectedEventId('');
    if (window.innerWidth >= 600) {
      setShowSidePanel(true);
    } else {
      setShowSheet(true);
    }
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
    setPrefilledRoomId('');
    setPrefilledPeriod('');
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

  const ensureTodayIfEmpty = () => {
    if (!selectedDate) {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ds = `${y}-${m}-${dd}`;
      setSelectedDate(ds);
      setDailyTableDate(ds);
    }
  };

  const handleFabClick = () => {
    ensureTodayIfEmpty();
    setShowSidePanel(true);
  };

  // 台帳ビューのセルクリック処理
  const handleLedgerCellClick = useCallback((roomId: string, period: string) => {
    if (!currentUser) {
      alert('予約機能を利用するにはログインが必要です');
      return;
    }
    setPrefilledRoomId(roomId);
    setPrefilledPeriod(period);
    setShowSidePanel(true);
  }, [currentUser]);

  // 台帳ビューの予約クリック処理
  const handleReservationClick = useCallback((reservationId: string) => {
    console.log('📅 予約クリック:', reservationId);
    setSelectedEventId(reservationId);
    setShowReservationModal(true);
  }, []);

  return (
    <div className="main-app">
      <header className="main-header">
        <h1>
          <img
            src={process.env.PUBLIC_URL + '/logo_clear.png'}
            alt="校章"
            className="header-logo"
            width={32}
            height={32}
          />{' '}
          桜和高校教室予約システム
        </h1>
        <div className="header-info">
          <div className="system-info">v{APP_VERSION}</div>
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
          <MonthlyReservationsProvider>
            <CalendarComponent
              key={refreshKey}
              refreshTrigger={refreshKey}
              selectedDate={selectedDate} // 選択日付を渡す
              filterMine={filterMine}
              onFilterMineChange={setFilterMine}
              onDateNavigate={handleDateNavigate}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
              onLedgerCellClick={handleLedgerCellClick}
              onReservationClick={handleReservationClick}
            />
          </MonthlyReservationsProvider>
        </div>

        {showSidePanel && (
          <aside className="side-panel-section">
            <button className="mobile-close-panel only-mobile" onClick={handleCloseSidePanel} aria-label="パネルを閉じる">← カレンダーへ戻る</button>
            <MonthlyReservationsProvider>
              <ReservationDataProvider date={selectedDate}>
                <SidePanel
                  selectedDate={selectedDate}
                  selectedEventId={selectedEventId}
                  onClose={handleCloseSidePanel}
                  onReservationCreated={handleReservationCreated}
                  prefilledRoomId={prefilledRoomId}
                  prefilledPeriod={prefilledPeriod}
                />
              </ReservationDataProvider>
            </MonthlyReservationsProvider>
          </aside>
        )}
      </main>

      <footer className="main-footer">
        <p>© 2025 桜和高校教室予約システム (owa-cbs) - Developed by YUKI KONDO</p>
      </footer>

      {/* モバイルFAB（プレビュー限定） */}
      {isPreview && (
        <button
          className="fab only-mobile"
          aria-label="予約を追加"
          onClick={handleFabClick}
          title="予約を追加"
        >
          ＋
        </button>
      )}
      
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

      {/* 予約シート（モバイル用） */}
      <ReservationSheet
        date={dailyTableDate}
        open={showSheet}
        onClose={()=>setShowSheet(false)}
        onOpenSidePanel={()=>{ setShowSheet(false); setShowSidePanel(true); }}
      />
    </div>
  );
};

export default MainApp;
