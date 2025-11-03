import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './DailyLedgerView.css';
import { roomsService, Reservation, Room } from '../firebase/firestore';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { Timestamp } from 'firebase/firestore';
import { PERIOD_ORDER, periodTimeMap } from '../utils/periods';
import { toDateStr } from '../utils/dateRange';
import { authService } from '../firebase/auth';

interface DailyLedgerViewProps {
  date: string;
  filterMine?: boolean;
  onFilterMineChange?: (value: boolean) => void;
  onDateChange?: (dateStr: string) => void;
  onCellClick?: (roomId: string, period: string) => void;
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

const classifyRoom = (roomName: string): string => {
  if (!roomName) return 'room-cat-default';
  if (/^小演習室/.test(roomName)) return 'room-cat-small';
  if (/^大演習室/.test(roomName)) return 'room-cat-large';
  if (/社会|LL|グローバル/.test(roomName)) return 'room-cat-purple';
  if (/モノラボ|視聴覚|多目的/.test(roomName)) return 'room-cat-blue';
  if (/サテライト|会議室/.test(roomName)) return 'room-cat-red';
  return 'room-cat-default';
};

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

export const DailyLedgerView: React.FC<DailyLedgerViewProps> = ({ date, filterMine = false, onFilterMineChange, onDateChange, onCellClick, onReservationClick }) => {
  const normalizedDate = normalizeDateInput(date);
  const [rooms, setRooms] = useState<Room[]>([]);
  const { reservations, setRange } = useMonthlyReservations();
  const tableWrapperRef = useRef<HTMLDivElement>(null);

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

  const reservationsForDate = useMemo(() => {
    const target = normalizedDate;
    return reservations.filter(r => {
      const startTime = r.startTime instanceof Timestamp ? r.startTime.toDate() : new Date(r.startTime as any);
      return toDateStr(startTime) === target;
    });
  }, [reservations, normalizedDate]);

  const cellMap = useMemo(() => mapReservationsToCells(reservationsForDate, rooms, filterMine), [reservationsForDate, rooms, filterMine]);

  const handleDateChange = useCallback((next: string) => {
    if (!onDateChange) return;
    const normalized = normalizeDateInput(next);
    onDateChange(normalized);
  }, [onDateChange]);

  const displayRooms = rooms;

  // マウスホイールでの横スクロールをサポート
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!tableWrapperRef.current) return;
    // Shiftキーが押されていない場合、縦スクロールを横スクロールに変換
    if (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      tableWrapperRef.current.scrollBy({ left: event.deltaY, behavior: 'auto' });
      event.preventDefault();
    }
  }, []);

  return (
    <div className="ledger-view">
      <div className="ledger-toolbar">
        <div className="ledger-nav-buttons">
          <button type="button" onClick={() => handleDateChange(toDateStr(new Date(new Date(`${normalizedDate}T00:00:00`).getTime() - 86400000)))}>&lt; 前日</button>
          <button type="button" onClick={() => handleDateChange(toDateStr(new Date()))}>今日</button>
          <button type="button" onClick={() => handleDateChange(toDateStr(new Date(new Date(`${normalizedDate}T00:00:00`).getTime() + 86400000)))}>翌日 &gt;</button>
        </div>
        <label className="ledger-date-picker">
          日付
          <input type="date" value={normalizedDate} onChange={e => handleDateChange(e.target.value)} />
        </label>
        <label className="ledger-filter-mine">
          自分の予約のみ
          <input
            type="checkbox"
            checked={filterMine}
            onChange={e => onFilterMineChange && onFilterMineChange(e.target.checked)}
          />
        </label>
      </div>
      <div className="ledger-table-wrapper" ref={tableWrapperRef} onWheel={handleWheel}>
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="ledger-period-header">時限</th>
              {displayRooms.map(room => (
                <th key={String(room.id || room.name)} className="ledger-room-header">{room.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIOD_ORDER.map(periodKey => {
              const meta = periodTimeMap[periodKey];
              const label = meta?.name || periodKey;
              return (
                <tr key={periodKey}>
                  <th className="ledger-period-cell">
                    <div className="period-label">{label}</div>
                    <div className="period-time">{meta ? `${meta.start} - ${meta.end}` : ''}</div>
                  </th>
                  {displayRooms.map(room => {
                    const reservationsForCell = cellMap.get(String(room.id || ''))?.get(String(periodKey)) || [];
                    const handleCellClick = () => {
                      if (reservationsForCell.length === 0 && onCellClick && room.id) {
                        onCellClick(room.id, periodKey);
                      }
                    };
                    return (
                      <td 
                        key={`${room.id || room.name}-${periodKey}`} 
                        className={`ledger-reservation-cell ${classifyRoom(room.name)} ${reservationsForCell.length === 0 ? 'ledger-cell-clickable' : ''}`.trim()}
                        onClick={handleCellClick}
                      >
                        {reservationsForCell.length === 0 ? (
                          <span className="ledger-empty">—</span>
                        ) : (
                          <ul className="ledger-reservation-list">
                            {reservationsForCell.map(item => (
                              <li key={item.id} className="ledger-reservation-item">
                                <button
                                  type="button"
                                  className="ledger-reservation-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onReservationClick) {
                                      onReservationClick(item.id);
                                    }
                                  }}
                                >
                                  <span className="ledger-reservation-title">{item.title || '（名称未設定）'}</span>
                                  {item.reservationName && (
                                    <span className="ledger-reservation-owner">{item.reservationName}</span>
                                  )}
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
