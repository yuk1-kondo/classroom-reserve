// メインアプリケーションコンポーネント
import React, { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import CalendarComponent from './CalendarComponent';
import SidePanel from './SidePanel';
import ReservationModal from './ReservationModal';
import ReservationSheet from './ReservationSheet';
import { useAuth } from '../hooks/useAuth';
import './MainApp.css';
import { APP_VERSION } from '../version';
import { ReservationDataProvider } from '../contexts/ReservationDataContext';
import { MonthlyReservationsProvider } from '../contexts/MonthlyReservationsContext';
import { getTodayString } from '../utils/dateUtils';

export const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  
  // URLパラメータから初期日付を取得
  const getInitialDate = (): string => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
    return '';
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(getInitialDate());
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [filterMine, setFilterMine] = useState<boolean>(false);
  const [prefilledRoomId, setPrefilledRoomId] = useState<string>('');
  const [prefilledPeriod, setPrefilledPeriod] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  
  // プレビュー判定（クリーンパス/クエリ対応）
  const isPreview = (() => {
    if (typeof window === 'undefined') return false;
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('preview') === '1') return true;
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/preview' || path === '/ux-preview';
  })();
  
  // 日付が変更されたらURLを更新
  useEffect(() => {
    if (selectedDate) {
      const params = new URLSearchParams(window.location.search);
      params.set('date', selectedDate);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [selectedDate]);

  // 日付クリック処理
  const handleDateNavigate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
  }, []);

  // カレンダーの日付クリック処理
  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setShowSidePanel(true);
  }, []);

  // カレンダーのイベントクリック処理
  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setShowReservationModal(true);
  }, []);

  // サイドパネル閉じる
  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
    setSelectedDate('');
    setSelectedEventId('');
    setPrefilledRoomId('');
    setPrefilledPeriod('');
  };

  // 予約作成/更新/削除後の処理（データを再取得）
  const handleReservationCreated = useCallback(() => {
    // Providerを再マウントしてデータを再取得
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleFabClick = () => {
    if (!selectedDate) {
      setSelectedDate(getTodayString());
    }
    setShowSidePanel(true);
  };

  // 台帳ビューのセルクリック処理
  const handleLedgerCellClick = useCallback((roomId: string, period: string, date: string) => {
    if (!currentUser) {
      toast.error('予約機能を利用するにはログインが必要です');
      return;
    }
    setSelectedDate(date);
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
      {/* Toast通知コンポーネント */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
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
          <MonthlyReservationsProvider key={`calendar-${refreshKey}`}>
            <CalendarComponent
              selectedDate={selectedDate}
              filterMine={filterMine}
              onFilterMineChange={setFilterMine}
              onDateNavigate={handleDateNavigate}
              onLedgerCellClick={handleLedgerCellClick}
              onReservationClick={handleReservationClick}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          </MonthlyReservationsProvider>
        </div>

        {showSidePanel && (
          <aside className="side-panel-section">
            <button className="mobile-close-panel only-mobile" onClick={handleCloseSidePanel} aria-label="パネルを閉じる">← カレンダーへ戻る</button>
            <MonthlyReservationsProvider key={`side-${refreshKey}`}>
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
        date={selectedDate}
        open={showSheet}
        onClose={()=>setShowSheet(false)}
        onOpenSidePanel={()=>{ setShowSheet(false); setShowSidePanel(true); }}
      />
    </div>
  );
};

export default MainApp;
