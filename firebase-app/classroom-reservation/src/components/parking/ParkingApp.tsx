import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useParkingAccess } from '../../hooks/useParkingAccess';
import { ParkingReservationsProvider } from '../../contexts/ParkingReservationsContext';
import { ParkingSpot, parkingSettingsService, parkingSpotsService } from '../../firebase/parking';
import { toDateStr } from '../../utils/dateRange';
import { isParkingSessionUnlocked, unlockParkingSession } from '../../utils/parkingUnlock';
import PasscodeModal from '../PasscodeModal';
import SimpleLogin from '../SimpleLogin';
import ParkingLedgerView from './ParkingLedgerView';
import ParkingCreateModal from './ParkingCreateModal';
import ParkingDetailModal from './ParkingDetailModal';
import { AppHeader } from '../layout/AppHeader';
import { AppFooter } from '../layout/AppFooter';
import '../MainApp.css';

const shiftDateStr = (dateStr: string, offsetDays: number) => {
  const base = new Date(`${dateStr}T00:00:00`);
  base.setDate(base.getDate() + offsetDays);
  return toDateStr(base);
};

const ParkingAppInner: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, loading: authLoading, authReady } = useAuth();
  const parking = useParkingAccess(currentUser?.uid, { isAdmin, authReady });
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [filterMine, setFilterMine] = useState(false);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [createRequest, setCreateRequest] = useState<{ spotId: string; period: string } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [accessPasscode, setAccessPasscode] = useState('');
  const [passcodeLoading, setPasscodeLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setPasscodeLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setPasscodeLoading(true);
        const code = await parkingSettingsService.getAccessPasscode();
        if (!mounted) return;
        setAccessPasscode(code);
        setUnlocked(isParkingSessionUnlocked(code));
      } catch {
        if (mounted) {
          setAccessPasscode('');
          setUnlocked(false);
        }
      } finally {
        if (mounted) setPasscodeLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!unlocked) return;
    parkingSpotsService
      .getAllSpots()
      .then(list => setSpots(Array.isArray(list) ? list : []))
      .catch(() => setSpots([]));
  }, [unlocked]);

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

  const handleUnlockSuccess = useCallback(() => {
    unlockParkingSession(accessPasscode);
    setUnlocked(true);
  }, [accessPasscode]);

  const handleShiftDate = useCallback((offset: number) => {
    setSelectedDate(prev => shiftDateStr(prev, offset));
  }, []);

  if (authLoading || passcodeLoading) {
    return (
      <div className="main-app">
        <AppHeader title="桜和高校駐車場予約" current="parking" />
        <main className="main-content auth-gate">
          <p className="auth-gate-message">読み込み中…</p>
        </main>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="main-app">
        <AppHeader title="桜和高校駐車場予約" current="parking" />
        <main className="main-content auth-gate">
          <SimpleLogin variant="page" onAuthStateChange={() => undefined} />
        </main>
        <AppFooter />
      </div>
    );
  }

  if (!accessPasscode) {
    return (
      <div className="main-app">
        <AppHeader title="桜和高校駐車場予約" current="parking" />
        <main className="main-content auth-gate">
          <div className="auth-gate-card">
            <h2>パスコードが未設定です</h2>
            <p>管理者が入場用パスコードを設定するまで、駐車場予約は利用できません。</p>
            {isAdmin && (
              <p>
                <Link to="/admin?section=parking" className="admin-settings-link">
                  管理・設定でパスコードを設定
                </Link>
              </p>
            )}
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="main-app">
        <AppHeader title="桜和高校駐車場予約" current="parking" />
        <main className="main-content auth-gate">
          <p className="auth-gate-message">駐車場予約を利用するには、パスコードの入力が必要です。</p>
        </main>
        <PasscodeModal
          isOpen
          onClose={() => navigate('/')}
          onSuccess={handleUnlockSuccess}
          correctPasscode={accessPasscode}
          title="駐車場パスコード"
          submitLabel="認証して入る"
          description={
            <>
              駐車場予約を利用するには<br />
              パスコードを入力してください。
            </>
          }
        />
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="main-app">
      <AppHeader title="桜和高校駐車場予約" current="parking" />

      <main className="main-content">
        <div className="ledger-preview-section">
          <div className="ledger-preview-header">
            <div className="ledger-preview-nav" role="group" aria-label="日付移動">
              <button type="button" onClick={() => handleShiftDate(-1)} aria-label="前日">
                &lt; 前日
              </button>
              <button type="button" onClick={() => setSelectedDate(toDateStr(new Date()))} aria-label="今日">
                今日
              </button>
              <button type="button" onClick={() => handleShiftDate(1)} aria-label="翌日">
                翌日 &gt;
              </button>
            </div>
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
            showToolbar={false}
            onDateChange={setSelectedDate}
            onCellClick={handleCellClick}
            onReservationClick={id => setSelectedEventId(id)}
          />
        </div>
      </main>

      <AppFooter />

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
