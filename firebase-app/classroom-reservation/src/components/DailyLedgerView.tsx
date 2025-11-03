import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './DailyLedgerView.css';
import { roomsService, Room } from '../firebase/firestore';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { Timestamp } from 'firebase/firestore';
import { PERIOD_ORDER, periodTimeMap } from '../utils/periods';
import { toDateStr } from '../utils/dateRange';
import { addDaysToDateString, getTodayString } from '../utils/dateUtils';
import { handleError } from '../utils/errorHandling';
import {
  normalizeDateInput,
  classifyRoom,
  sortRoomsWithOrder,
  mapReservationsToCells
} from '../utils/ledger';

interface DailyLedgerViewProps {
  date: string;
  filterMine?: boolean;
  onFilterMineChange?: (value: boolean) => void;
  onDateChange?: (dateStr: string) => void;
  onCellClick?: (roomId: string, period: string) => void;
  onReservationClick?: (reservationId: string) => void;
}

export const DailyLedgerView: React.FC<DailyLedgerViewProps> = ({ date, filterMine = false, onFilterMineChange, onDateChange, onCellClick, onReservationClick }) => {
  const normalizedDate = normalizeDateInput(date);
  const [rooms, setRooms] = useState<Room[]>([]);
  const { reservations, setRange } = useMonthlyReservations();
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    roomsService.getAllRooms()
      .then(list => {
        if (!active) return;
        setRooms(sortRoomsWithOrder(Array.isArray(list) ? list : []));
      })
      .catch(error => {
        if (!active) return;
        handleError(error, '教室一覧の取得');
        setRooms([]);
      });
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
          <button type="button" onClick={() => handleDateChange(addDaysToDateString(normalizedDate, -1))}>&lt; 前日</button>
          <button type="button" onClick={() => handleDateChange(getTodayString())}>今日</button>
          <button type="button" onClick={() => handleDateChange(addDaysToDateString(normalizedDate, 1))}>翌日 &gt;</button>
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
