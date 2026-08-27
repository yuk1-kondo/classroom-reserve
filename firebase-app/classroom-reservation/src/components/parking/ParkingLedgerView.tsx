import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../DailyLedgerView.css';
import { Reservation } from '../../firebase/firestore';
import { ParkingSpot, parkingSpotsService } from '../../firebase/parking';
import { useParkingReservations } from '../../contexts/ParkingReservationsContext';
import { Timestamp } from 'firebase/firestore';
import { getPeriodOrderForDate, getPeriodTimeMapForDate } from '../../utils/periods';
import { toDateStr } from '../../utils/dateRange';
import { authService } from '../../firebase/auth';

interface ParkingLedgerViewProps {
  date: string;
  authReady: boolean;
  filterMine?: boolean;
  onDateChange?: (dateStr: string) => void;
  onCellClick?: (spotId: string, period: string, date: string) => void;
  onReservationClick?: (reservationId: string) => void;
}

interface LedgerCellReservation {
  id: string;
  title: string;
  reservationName: string;
  period: string;
  roomId: string;
}

function expandPeriod(raw: string): string[] {
  const p = String(raw || '');
  if (p.includes(',')) {
    return p.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (/^\d+\s*-\s*\d+$/.test(p)) {
    const [a, b] = p.split('-').map(s => parseInt(s.trim(), 10));
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const list: string[] = [];
      for (let x = min; x <= max; x += 1) list.push(String(x));
      return list;
    }
  }
  return [p];
}

function classifySpot(name: string): string {
  if (/東門/.test(name)) return 'room-cat-red';
  if (/西門/.test(name)) return 'room-cat-blue';
  return 'room-cat-default';
}

const mapReservationsToCells = (
  reservations: Reservation[],
  filterMine: boolean
): Map<string, Map<string, LedgerCellReservation[]>> => {
  const cellMap = new Map<string, Map<string, LedgerCellReservation[]>>();
  const currentUser = authService.getCurrentUser();

  reservations.forEach(reservation => {
    if (!reservation.roomId) return;
    if (filterMine) {
      if (!currentUser || reservation.createdBy !== currentUser.uid) return;
    }
    expandPeriod(reservation.period).forEach(period => {
      const periodKey = String(period);
      if (!cellMap.has(reservation.roomId)) {
        cellMap.set(reservation.roomId, new Map());
      }
      const periodMap = cellMap.get(reservation.roomId)!;
      if (!periodMap.has(periodKey)) periodMap.set(periodKey, []);
      periodMap.get(periodKey)!.push({
        id: reservation.id || `${reservation.roomId}-${period}`,
        title: reservation.title,
        reservationName: reservation.reservationName,
        period: periodKey,
        roomId: reservation.roomId
      });
    });
  });

  cellMap.forEach(periodMap => {
    periodMap.forEach((items, key) => {
      periodMap.set(key, [...items].sort((a, b) => a.title.localeCompare(b.title, 'ja')));
    });
  });
  return cellMap;
};

export const ParkingLedgerView: React.FC<ParkingLedgerViewProps> = ({
  date,
  authReady,
  filterMine = false,
  onDateChange,
  onCellClick,
  onReservationClick
}) => {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [spotsLoaded, setSpotsLoaded] = useState(false);
  const { reservations, setRange, refetch, loading: reservationsLoading } = useParkingReservations();
  const [loading, setLoading] = useState(true);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const tableWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const revealedRef = React.useRef(false);

  useEffect(() => {
    let active = true;
    if (!authReady) return;
    setSpotsLoaded(false);
    parkingSpotsService
      .getAllSpots()
      .then(list => {
        if (!active) return;
        setSpots(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!active) return;
        setSpots([]);
      })
      .finally(() => {
        if (active) setSpotsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [authReady]);

  useEffect(() => {
    if (!authReady || !date) return;
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    setRange(start, end);
  }, [date, setRange, authReady]);

  useEffect(() => {
    const handler = () => {
      if (!authReady) return;
      void refetch();
    };
    window.addEventListener('parking:changed', handler);
    return () => window.removeEventListener('parking:changed', handler);
  }, [refetch, authReady]);

  useEffect(() => {
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { type?: string; id?: string };
      if (detail?.type === 'deleted' && detail?.id) {
        setRemovedIds(prev => new Set(prev).add(String(detail.id)));
      }
    };
    window.addEventListener('parking:changed', onChanged);
    return () => window.removeEventListener('parking:changed', onChanged);
  }, []);

  const reservationsForDate = useMemo(() => {
    return reservations.filter(r => {
      const startTime = r.startTime instanceof Timestamp ? r.startTime.toDate() : new Date(r.startTime as any);
      if (removedIds.has(String(r.id))) return false;
      return toDateStr(startTime) === date;
    });
  }, [reservations, date, removedIds]);

  const cellMap = useMemo(
    () => mapReservationsToCells(reservationsForDate, filterMine),
    [reservationsForDate, filterMine]
  );

  useEffect(() => {
    if (!authReady || !spotsLoaded || reservationsLoading) {
      if (!revealedRef.current) setLoading(true);
      return;
    }
    revealedRef.current = true;
    const timer = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(timer);
  }, [authReady, spotsLoaded, reservationsLoading, date]);

  const handleDateChange = useCallback(
    (next: string) => {
      onDateChange?.(next);
    },
    [onDateChange]
  );

  return (
    <div className={`ledger-view ${loading ? 'is-loading' : ''}`.trim()}>
      {loading && (
        <div className="ledger-skeleton" aria-live="polite">読み込み中...</div>
      )}
      <div className="ledger-toolbar ledger-toolbar--compact">
        <div className="ledger-nav-buttons" role="group" aria-label="日付移動">
          <button
            type="button"
            className="ledger-nav-button"
            onClick={() => handleDateChange(toDateStr(new Date(new Date(`${date}T00:00:00`).getTime() - 86400000)))}
            disabled={reservationsLoading}
          >
            &lt; 前日
          </button>
          <button
            type="button"
            className="ledger-nav-button"
            onClick={() => handleDateChange(toDateStr(new Date()))}
            disabled={reservationsLoading}
          >
            今日
          </button>
          <button
            type="button"
            className="ledger-nav-button"
            onClick={() => handleDateChange(toDateStr(new Date(new Date(`${date}T00:00:00`).getTime() + 86400000)))}
            disabled={reservationsLoading}
          >
            翌日 &gt;
          </button>
        </div>
      </div>
      <div className="ledger-table-wrapper" ref={tableWrapperRef}>
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="ledger-period-header">時限</th>
              {spots.map(spot => (
                <th
                  key={String(spot.id || spot.name)}
                  className={`ledger-room-header ${classifySpot(spot.name)}`.trim()}
                >
                  {spot.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {getPeriodOrderForDate(date).map(periodKey => {
              const periodMap = getPeriodTimeMapForDate(date);
              const meta = periodMap[periodKey];
              const label = meta?.name || periodKey;
              return (
                <tr key={periodKey}>
                  <th className="ledger-period-cell">
                    <div className="period-cell-inner">
                      <span className="period-label">{label}</span>
                      <span className="period-time">{meta ? `${meta.start} - ${meta.end}` : ''}</span>
                    </div>
                  </th>
                  {spots.map(spot => {
                    const reservationsForCell = cellMap.get(String(spot.id || ''))?.get(String(periodKey)) || [];
                    const spotId = spot.id ? String(spot.id) : '';
                    const isEmpty = reservationsForCell.length === 0;
                    const isClickable = Boolean(isEmpty && spotId && onCellClick);
                    return (
                      <td
                        key={`${spot.id || spot.name}-${periodKey}`}
                        className={`ledger-reservation-cell ${classifySpot(spot.name)} ${isClickable ? 'ledger-cell-clickable' : ''}`.trim()}
                        onClick={() => {
                          if (isClickable) onCellClick?.(spotId, String(periodKey), date);
                        }}
                      >
                        {isEmpty ? (
                          <span className="ledger-empty">—</span>
                        ) : (
                          <ul className="ledger-reservation-list">
                            {reservationsForCell.map(item => (
                              <li key={item.id} className="ledger-reservation-item">
                                <button
                                  type="button"
                                  className="ledger-reservation-button"
                                  onClick={event => {
                                    event.stopPropagation();
                                    if (item.id && onReservationClick) onReservationClick(item.id);
                                  }}
                                >
                                  <span className="ledger-reservation-title">{item.title || '（名称未設定）'}</span>
                                  <span className="ledger-reservation-owner">
                                    {item.reservationName || '予約者未設定'}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {spotsLoaded && spots.length === 0 && (
        <p style={{ margin: '8px 4px 0', fontSize: '0.9rem', color: '#666' }}>
          駐車場枠がまだ登録されていません。管理者が「管理・設定」から枠を登録してください。
        </p>
      )}
    </div>
  );
};

export default ParkingLedgerView;
