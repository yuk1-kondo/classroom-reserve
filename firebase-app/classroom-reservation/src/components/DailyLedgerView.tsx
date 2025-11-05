import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './DailyLedgerView.css';
import { roomsService, Reservation, Room } from '../firebase/firestore';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { Timestamp } from 'firebase/firestore';
import { getPeriodOrderForDate, getPeriodTimeMapForDate } from '../utils/periods';
import { toDateStr } from '../utils/dateRange';
import { authService } from '../firebase/auth';

interface DailyLedgerViewProps {
  date: string;
  filterMine?: boolean;
  onFilterMineChange?: (value: boolean) => void;
  onDateChange?: (dateStr: string) => void;
  showFilterMineToggle?: boolean;
  showToolbar?: boolean;
  onCellClick?: (roomId: string, period: string, date: string) => void;
  onReservationClick?: (reservationId: string) => void;
}

interface LedgerCellReservation {
  id: string;
  title: string;
  reservationName: string;
  period: string;
  roomId: string;
}

const LEDGER_ROOM_ORDER = [
  'サテライト',
  '会議室',
  '会議室（小）',
  '社会科教室',
  'グローバル教室①',
  'グローバル教室②',
  'LL教室',
  'モノラボ',
  '視聴覚教室',
  '多目的室',
  '大演習室1',
  '大演習室2',
  '大演習室3',
  '大演習室4',
  '小演習室1',
  '小演習室2',
  '小演習室3',
  '小演習室4',
  '小演習室5',
  '小演習室6'
];

function normalizeDateInput(dateStr: string): string {
  if (!dateStr) {
    const today = new Date();
    return toDateStr(today);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  try {
    return toDateStr(new Date(dateStr));
  } catch {
    return dateStr.slice(0, 10);
  }
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

const sortRoomsWithOrder = (rooms: Room[]): Room[] => {
  const orderMap = new Map<string, number>();
  LEDGER_ROOM_ORDER.forEach((name, index) => orderMap.set(name, index));
  return [...rooms].sort((a, b) => {
    const aOrder = orderMap.has(a.name) ? orderMap.get(a.name)! : Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.has(b.name) ? orderMap.get(b.name)! : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name, 'ja');
  });
};

const mapReservationsToCells = (
  reservations: Reservation[],
  rooms: Room[],
  filterMine: boolean
): Map<string, Map<string, LedgerCellReservation[]>> => {
  const cellMap = new Map<string, Map<string, LedgerCellReservation[]>>();
  const currentUser = authService.getCurrentUser();

  const allowReservation = (reservation: Reservation) => {
    if (!filterMine) return true;
    if (!currentUser) return false;
    return reservation.createdBy === currentUser.uid;
  };

  reservations.forEach(reservation => {
    if (!reservation.roomId || !allowReservation(reservation)) return;
    const periods = expandPeriod(reservation.period);
    periods.forEach(period => {
      const periodKey = String(period);
      if (!cellMap.has(reservation.roomId)) {
        cellMap.set(reservation.roomId, new Map());
      }
      const periodMap = cellMap.get(reservation.roomId)!;
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, []);
      }
      const list = periodMap.get(periodKey)!;
      list.push({
        id: reservation.id || `${reservation.roomId}-${period}-${list.length}`,
        title: reservation.title,
        reservationName: reservation.reservationName,
        period: periodKey,
        roomId: reservation.roomId
      });
    });
  });

  const sortCellReservations = (items: LedgerCellReservation[]): LedgerCellReservation[] => {
    return [...items].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  };

  cellMap.forEach(periodMap => {
    periodMap.forEach((items, key) => {
      periodMap.set(key, sortCellReservations(items));
    });
  });

  return cellMap;
};

const classifyRoom = (roomName: string): string => {
  if (!roomName) return 'room-cat-default';
  if (/^小演習室/.test(roomName)) return 'room-cat-small';
  if (/^大演習室/.test(roomName)) return 'room-cat-large';
  if (/社会|LL|グローバル/.test(roomName)) return 'room-cat-purple';
  if (/モノラボ|視聴覚|多目的/.test(roomName)) return 'room-cat-blue';
  if (/サテライト|会議室/.test(roomName)) return 'room-cat-red';
  return 'room-cat-default';
};

export const DailyLedgerView: React.FC<DailyLedgerViewProps> = ({
  date,
  filterMine = false,
  onFilterMineChange,
  onDateChange,
  showFilterMineToggle = true,
  showToolbar = true,
  onCellClick,
  onReservationClick
}) => {
  const normalizedDate = normalizeDateInput(date);
  const [rooms, setRooms] = useState<Room[]>([]);
  const { reservations, setRange } = useMonthlyReservations();
  const [loading, setLoading] = useState<boolean>(true);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    roomsService.getAllRooms().then(list => {
      if (!active) return;
      setRooms(sortRoomsWithOrder(Array.isArray(list) ? list : []));
    }).catch(() => setRooms([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!normalizedDate) return;
    const start = new Date(`${normalizedDate}T00:00:00`);
    const end = new Date(`${normalizedDate}T23:59:59`);
    setRange(start, end);
  }, [normalizedDate, setRange]);

  // 予約変更イベントを受けて当日範囲を即時再読込
  useEffect(() => {
    const handler = () => {
      if (!normalizedDate) return;
      const start = new Date(`${normalizedDate}T00:00:00`);
      const end = new Date(`${normalizedDate}T23:59:59`);
      setRange(start, end);
    };
    window.addEventListener('reservation:changed', handler as any);
    return () => window.removeEventListener('reservation:changed', handler as any);
  }, [normalizedDate, setRange]);

  // ローカル即時反映: 削除IDを保持し、描画から除外
  useEffect(() => {
    const onChanged = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail as any;
        if (detail?.type === 'deleted' && detail?.id) {
          setRemovedIds(prev => {
            const next = new Set(prev);
            next.add(String(detail.id));
            return next;
          });
        }
      } catch {}
    };
    window.addEventListener('reservation:changed', onChanged as any);
    return () => window.removeEventListener('reservation:changed', onChanged as any);
  }, []);

  const reservationsForDate = useMemo(() => {
    const target = normalizedDate;
    return reservations.filter(r => {
      const startTime = r.startTime instanceof Timestamp ? r.startTime.toDate() : new Date(r.startTime as any);
      if (removedIds.has(String(r.id))) return false;
      return toDateStr(startTime) === target;
    });
  }, [reservations, normalizedDate, removedIds]);

  const cellMap = useMemo(() => mapReservationsToCells(reservationsForDate, rooms, filterMine), [reservationsForDate, rooms, filterMine]);

  const handleDateChange = useCallback((next: string) => {
    if (!onDateChange) return;
    const normalized = normalizeDateInput(next);
    onDateChange(normalized);
  }, [onDateChange]);

  const displayRooms = rooms;

  const toolbarClassName = showFilterMineToggle ? 'ledger-toolbar' : 'ledger-toolbar ledger-toolbar--compact';

  // データが揃うまで全体を隠し、スケルトンを見せる
  useEffect(() => {
    if (displayRooms.length > 0) {
      const timer = setTimeout(() => setLoading(false), 120);
      return () => clearTimeout(timer);
    } else {
      setLoading(true);
    }
  }, [displayRooms.length, normalizedDate]);

  return (
    <div className={`ledger-view ${loading ? 'is-loading' : ''}`.trim()}>
      {loading && (
        <div className="ledger-skeleton" aria-live="polite">読み込み中...</div>
      )}
      {showToolbar && (
        <div className={toolbarClassName}>
          <div className="ledger-nav-buttons" role="group" aria-label="日付移動">
            <button
              type="button"
              className="ledger-nav-button"
              onClick={() => handleDateChange(toDateStr(new Date(new Date(`${normalizedDate}T00:00:00`).getTime() - 86400000)))}
            >
              &lt; 前日
            </button>
            <button
              type="button"
              className="ledger-nav-button"
              onClick={() => handleDateChange(toDateStr(new Date()))}
            >
              今日
            </button>
            <button
              type="button"
              className="ledger-nav-button"
              onClick={() => handleDateChange(toDateStr(new Date(new Date(`${normalizedDate}T00:00:00`).getTime() + 86400000)))}
            >
              翌日 &gt;
            </button>
          </div>
          <label className="ledger-date-picker">
            日付
            <input type="date" value={normalizedDate} onChange={e => handleDateChange(e.target.value)} />
          </label>
          {showFilterMineToggle && (
            <label className="ledger-filter-mine">
              自分の予約のみ
              <input
                type="checkbox"
                checked={filterMine}
                onChange={e => onFilterMineChange && onFilterMineChange(e.target.checked)}
              />
            </label>
          )}
        </div>
      )}
      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="ledger-period-header">時限</th>
              {displayRooms.map(room => (
                <th
                  key={String(room.id || room.name)}
                  className="ledger-room-header"
                >
                  {room.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {getPeriodOrderForDate(normalizedDate).map(periodKey => {
              const periodMap = getPeriodTimeMapForDate(normalizedDate);
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
                  {displayRooms.map(room => {
                    const reservationsForCell = cellMap.get(String(room.id || ''))?.get(String(periodKey)) || [];
                    const roomId = room.id ? String(room.id) : '';
                    const isEmpty = reservationsForCell.length === 0;
                    const categoryClass = classifyRoom(room.name);
                    const isClickable = Boolean(isEmpty && roomId && onCellClick);
                    const handleActivate = () => {
                      if (isClickable) {
                        onCellClick?.(roomId, String(periodKey), normalizedDate);
                      }
                    };
                    return (
                      <td
                        key={`${room.id || room.name}-${periodKey}`}
                        className={`ledger-reservation-cell ${categoryClass} ${isClickable ? 'ledger-cell-clickable' : ''}`.trim()}
                        onClick={handleActivate}
                        onKeyDown={event => {
                          if (!isClickable) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleActivate();
                          }
                        }}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
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
                                    if (item.id && onReservationClick) {
                                      onReservationClick(item.id);
                                    }
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
    </div>
  );
};

export default DailyLedgerView;
