// メインアプリケーションコンポーネント
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CalendarComponent from './CalendarComponent';
import SidePanel from './SidePanel';
import ReservationModal from './ReservationModal';
import DailyReservationTable from './DailyReservationTable';
import ReservationSheet from './ReservationSheet';
import DailyLedgerView from './DailyLedgerView';
import { useAuth } from '../hooks/useAuth';
import './MainApp.css';
import { APP_VERSION } from '../version';
import { ReservationDataProvider } from '../contexts/ReservationDataContext';
import { MonthlyReservationsProvider } from '../contexts/MonthlyReservationsContext';
import { toDateStr } from '../utils/dateRange';

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
  const [prefillRequest, setPrefillRequest] = useState<{ roomId: string; period: string; version: number } | null>(null);
  // プレビュー判定（クリーンパス/クエリ対応）
  const isPreview = (() => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname || '';
    if (/--?(?:ux-)?preview/i.test(host)) return true;
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('preview') === '1') return true;
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/preview' || path === '/ux-preview';
  })();

  useEffect(() => {
    if (!isPreview) return;
    if (!selectedDate) {
      const today = toDateStr(new Date());
      setSelectedDate(today);
      setDailyTableDate(today);
    }
  }, [isPreview, selectedDate]);

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
  const handleEventClick = useCallback((eventId: string) => {
    if (!eventId) return;
    console.log('📅 イベントクリック:', eventId);
    setSelectedEventId(eventId);
    setShowReservationModal(true);
  }, []);

  // サイドパネル閉じる
  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
    setSelectedEventId('');
    setPrefillRequest(null);
  };

  // 予約作成後の処理（リロードなしで差分更新）
  const handleReservationCreated = () => {
    // カレンダーを強制的に再読み込み（refreshKeyをインクリメント）
    // ※ Contextが更新されるため、実際にはFirestoreから再取得せずにUIが更新される
    setRefreshKey(prev => prev + 1);
  };

  const ensureTodayIfEmpty = useCallback(() => {
    if (!selectedDate) {
      const ds = toDateStr(new Date());
      setSelectedDate(ds);
      setDailyTableDate(ds);
    }
  }, [selectedDate]);

  const handleJumpToToday = useCallback(() => {
    const today = toDateStr(new Date());
    handleDateNavigate(today);
    setShowSheet(false);
  }, [handleDateNavigate]);

  const handleOpenReservationPanel = useCallback(() => {
    if (!currentUser) {
      alert('予約機能を利用するにはログインが必要です');
      return;
    }
    ensureTodayIfEmpty();
    if (typeof window !== 'undefined' && window.innerWidth < 600) {
      setShowSheet(true);
    } else {
      setShowSidePanel(true);
    }
  }, [currentUser, ensureTodayIfEmpty]);
  const handleLedgerCellClick = useCallback((roomId: string, period: string, date: string) => {
    if (!roomId || !period) return;
    handleDateNavigate(date);
    setPrefillRequest({
      roomId,
      period,
      version: Date.now()
    });
    handleOpenReservationPanel();
  }, [handleDateNavigate, handleOpenReservationPanel]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '日付を選択してください';
    try {
      const date = new Date(selectedDate);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const previewDateText = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const date = new Date(selectedDate);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const handleShiftDate = useCallback((offset: number) => {
    const base = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    base.setDate(base.getDate() + offset);
    handleDateNavigate(toDateStr(base));
  }, [selectedDate, handleDateNavigate]);

  return (
    <MonthlyReservationsProvider>
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
          {isPreview ? (
            <div className="ledger-preview-section">
              <div className="ledger-preview-header">
                <div className="ledger-preview-nav" role="group" aria-label="日付移動">
                  <button type="button" onClick={() => handleShiftDate(-1)}>&lt; 前日</button>
                  <button type="button" onClick={handleJumpToToday}>今日</button>
                  <button type="button" onClick={() => handleShiftDate(1)}>翌日 &gt;</button>
                </div>
                <div className="ledger-preview-date-block">
                  <span className="ledger-preview-date-text">{previewDateText || '日付未選択'}</span>
                </div>
                <div className="ledger-preview-controls">
                  <input
                    type="date"
                    className="ledger-preview-date-input"
                    value={selectedDate || ''}
                    onChange={e => handleDateNavigate(e.target.value)}
                    aria-label="日付を選択"
                  />
                  <label className="ledger-preview-filter">
                    <input
                      type="checkbox"
                      checked={filterMine}
                      onChange={e => setFilterMine(e.target.checked)}
                    />
                    自分の予約のみ
                  </label>
                  <button
                    type="button"
                    className="ledger-preview-manage"
                    onClick={handleOpenReservationPanel}
                    disabled={!currentUser}
                  >
                    予約を追加・編集
                  </button>
                </div>
              </div>
              <DailyLedgerView
                date={selectedDate || toDateStr(new Date())}
                filterMine={filterMine}
                onDateChange={handleDateNavigate}
                showFilterMineToggle={false}
                showToolbar={false}
                onCellClick={handleLedgerCellClick}
                onReservationClick={handleEventClick}
              />
            </div>
          ) : (
          <div className="calendar-section">
            <section className="calendar-quick-summary" aria-live="polite">
              <div className="summary-body">
                <div className="summary-nav" role="group" aria-label="日付移動">
                  <button
                    type="button"
                    className="summary-nav-button"
                    onClick={() => handleShiftDate(-1)}
                  >
                    &lt; 前日
                  </button>
                  <button
                    type="button"
                    className="summary-nav-button"
                    onClick={handleJumpToToday}
                  >
                    今日
                  </button>
                  <button
                    type="button"
                    className="summary-nav-button"
                    onClick={() => handleShiftDate(1)}
                  >
                    翌日 &gt;
                  </button>
                </div>
                <div className="summary-date">
                  <span className="summary-date-text">{formattedSelectedDate}</span>
                </div>
              </div>
              <div className="summary-actions">
                <button
                  type="button"
                  className="summary-chip"
                  onClick={handleJumpToToday}
                >
                  今日へ移動
                </button>
                <button
                  type="button"
                  className="summary-chip primary"
                  onClick={handleOpenReservationPanel}
                  disabled={!currentUser}
                >
                  予約を追加
                </button>
              </div>
            </section>

            <CalendarComponent
              key={refreshKey}
              refreshTrigger={refreshKey}
              selectedDate={selectedDate} // 選択日付を渡す
              filterMine={filterMine}
              onFilterMineChange={setFilterMine}
              onDateNavigate={handleDateNavigate}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
            
            {/* 日別予約一覧テーブル */}
            {dailyTableDate && (
              <ReservationDataProvider date={dailyTableDate}>
                <div className={`daily-table-container ${window.innerWidth < 600 ? 'only-desktop' : ''}`}>
                  <DailyReservationTable 
                    selectedDate={dailyTableDate}
                    showWhenEmpty={true}
                    filterMine={filterMine}
                    onFilterMineChange={setFilterMine}
                    onDateChange={(d)=>{
                      handleDateNavigate(d);
                    }}
                  />
                  {window.innerWidth < 600 && !showSidePanel && (
                    <div className="open-reserve-panel-wrapper">
                      <button onClick={()=>setShowSidePanel(true)} className="open-reserve-panel-btn">この日の予約を追加・編集</button>
                    </div>
                  )}
                </div>
              </ReservationDataProvider>
            )}
          </div>
          )}

          {showSidePanel && (
            <aside className="side-panel-section">
              <button className="mobile-close-panel only-mobile" onClick={handleCloseSidePanel} aria-label="パネルを閉じる">← カレンダーへ戻る</button>
              <ReservationDataProvider date={selectedDate}>
                <SidePanel
                  selectedDate={selectedDate}
                  selectedEventId={selectedEventId}
                  onClose={handleCloseSidePanel}
                  onReservationCreated={handleReservationCreated}
                  prefilledRoomId={prefillRequest?.roomId}
                  prefilledPeriod={prefillRequest?.period}
                  prefillVersion={prefillRequest?.version}
                />
              </ReservationDataProvider>
            </aside>
          )}
        </main>

        <footer className="main-footer">
          <p>© 2025 桜和高校教室予約システム (owa-cbs) - Developed by YUKI KONDO</p>
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

        {/* 予約シート（モバイル用） */}
        <ReservationSheet
          date={dailyTableDate}
          open={showSheet}
          onClose={()=>setShowSheet(false)}
          onOpenSidePanel={()=>{ setShowSheet(false); setShowSidePanel(true); }}
        />
      </div>
    </MonthlyReservationsProvider>
  );
};

export default MainApp;
