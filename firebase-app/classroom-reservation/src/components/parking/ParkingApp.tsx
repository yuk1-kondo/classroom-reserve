import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useParkingAccess } from '../../hooks/useParkingAccess';
import { ParkingReservationsProvider } from '../../contexts/ParkingReservationsContext';
import { ParkingSpot, parkingSpotsService } from '../../firebase/parking';
import { toDateStr } from '../../utils/dateRange';
import { APP_VERSION } from '../../version';
import ParkingLedgerView from './ParkingLedgerView';
import ParkingCreateModal from './ParkingCreateModal';
import ParkingDetailModal from './ParkingDetailModal';
import '../MainApp.css';

const ParkingAppInner: React.FC = () => {
  const { currentUser, isAdmin, loading: authLoading, authReady } = useAuth();
  const parking = useParkingAccess(currentUser?.uid, { isAdmin, authReady });
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [filterMine, setFilterMine] = useState(false);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [createRequest, setCreateRequest] = useState<{ spotId: string; period: string } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');

  useEffect(() => {
    if (!parking.canAccess) return;
    parkingSpotsService
      .getAllSpots()
      .then(list => setSpots(Array.isArray(list) ? list : []))
      .catch(() => setSpots([]));
  }, [parking.canAccess]);

  const previewDateText = useMemo(() => {
    try {
      return new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const handleCellClick = useCallback((spotId: string, period: string) => {
    if (!currentUser) return;
    setCreateRequest({ spotId, period });
  }, [currentUser]);

  if (authLoading || parking.loading) {
    return (
      <div className="main-app">
        <main className="main-content" style={{ padding: 24 }}>読み込み中…</main>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="main-app">
        <header className="main-header">
          <h1>駐車場予約</h1>
          <Link to="/" className="admin-settings-link">教室予約へ戻る</Link>
        </header>
        <main className="main-content" style={{ padding: 24 }}>
          <h2>ログインが必要です</h2>
          <p>駐車場予約を利用するには、教室予約トップからログインしてください。</p>
        </main>
      </div>
    );
  }

  if (!parking.canAccess) {
    return (
      <div className="main-app">
        <header className="main-header">
          <h1>駐車場予約</h1>
          <Link to="/" className="admin-settings-link">教室予約へ戻る</Link>
        </header>
        <main className="main-content" style={{ padding: 24 }}>
          <h2>アクセスできません</h2>
          <p>駐車場予約は現在テスト運用中のため、許可されたメンバーのみ利用できます。</p>
        </main>
      </div>
    );
  }

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
          駐車場予約
        </h1>
        <div className="header-info">
          <div className="system-info">v{APP_VERSION}</div>
          {parking.accessMode === 'group' && (
            <span className="system-info">テスト運用</span>
          )}
          {currentUser && isAdmin && (
            <Link to="/admin?section=parking" className="admin-settings-link">
              管理・設定
            </Link>
          )}
          <Link to="/" className="admin-settings-link">
            教室予約へ戻る
          </Link>
        </div>
      </header>

      <main className="main-content">
        <div className="ledger-preview-section">
          <div className="ledger-preview-header">
            <div className="ledger-preview-date-block">
              <span className="ledger-preview-date-text">{previewDateText}</span>
            </div>
            <div className="ledger-preview-controls">
              <input
                type="date"
                className="ledger-preview-date-input"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
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
            </div>
          </div>
          <ParkingLedgerView
            date={selectedDate}
            authReady={authReady}
            filterMine={filterMine}
            onDateChange={setSelectedDate}
            onCellClick={handleCellClick}
            onReservationClick={id => setSelectedEventId(id)}
          />
        </div>
      </main>

      <footer className="main-footer">
        <p>© 2025 桜和高校教室予約システム (owa-cbs)</p>
      </footer>

      {createRequest && (
        <ParkingCreateModal
          open
          date={selectedDate}
          spotId={createRequest.spotId}
          period={createRequest.period}
          spots={spots}
          currentUserUid={currentUser.uid}
          currentUserName={currentUser.displayName || currentUser.email || ''}
          onClose={() => setCreateRequest(null)}
        />
      )}

      <ParkingDetailModal
        open={Boolean(selectedEventId)}
        reservationId={selectedEventId || null}
        canDelete={parking.canDeleteReservation}
        canEdit={isAdmin}
        onClose={() => setSelectedEventId('')}
      />
    </div>
  );
};

export const ParkingApp: React.FC = () => (
  <ParkingReservationsProvider>
    <ParkingAppInner />
  </ParkingReservationsProvider>
);

export default ParkingApp;
