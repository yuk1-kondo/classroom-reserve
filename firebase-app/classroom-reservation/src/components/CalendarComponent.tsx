// カレンダーコンポーネント
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './CalendarComponent.css';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import DailyLedgerView from './DailyLedgerView';
import { toDateStr } from '../utils/dateRange';

interface CalendarComponentProps {
  onDateClick?: (dateStr: string) => void;
  onEventClick?: (eventId: string) => void;
  refreshTrigger?: number;
  selectedDate?: string;
  filterMine?: boolean;
  onFilterMineChange?: (v: boolean) => void;
  onDateNavigate?: (dateStr: string, origin?: 'calendar' | 'ledger') => void;
  onLedgerCellClick?: (roomId: string, period: string) => void;
  onReservationClick?: (reservationId: string) => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  roomId: string;
  roomName: string;
}

type FullCalendarViewType = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
type CalendarViewType = FullCalendarViewType | 'ledger';

const VIEW_STORAGE_KEY = 'calendar:lastView:v3';

const resolveInitialCalendarView = (): FullCalendarViewType => {
  if (typeof window === 'undefined') return 'timeGridWeek';
  const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
  if (saved === 'timeGridDay' || saved === 'timeGridWeek') {
    return saved;
  }
  return window.innerWidth < 600 ? 'timeGridDay' : 'timeGridWeek';
};

const resolveInitialDisplayView = (): CalendarViewType => {
  if (typeof window === 'undefined') return 'timeGridWeek';
  const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
  if (saved && ['timeGridDay', 'timeGridWeek', 'dayGridMonth', 'ledger'].includes(saved)) {
    return saved as CalendarViewType;
  }
  return window.innerWidth < 600 ? 'timeGridDay' : 'timeGridWeek';
};

const normalizeDate = (input?: string): string => {
  if (!input) return toDateStr(new Date());
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  try {
    return toDateStr(new Date(input));
  } catch {
    return input.slice(0, 10);
  }
};

export const CalendarComponent: React.FC<CalendarComponentProps> = ({
  onDateClick,
  onEventClick,
  refreshTrigger,
  selectedDate,
  filterMine: propFilterMine,
  onFilterMineChange,
  onDateNavigate,
  onLedgerCellClick,
  onReservationClick
}) => {
  const [ledgerDate, setLedgerDate] = useState<string>(() => normalizeDate(selectedDate));
  const filterMine = propFilterMine ?? false;

  useEffect(() => {
    if (selectedDate) {
      setLedgerDate(normalizeDate(selectedDate));
    }
  }, [selectedDate]);

  const handleLedgerDateChange = useCallback((nextDate: string) => {
    const normalized = normalizeDate(nextDate);
    setLedgerDate(normalized);
    onDateNavigate?.(normalized, 'ledger');
  }, [onDateNavigate]);

  return (
    <div className="calendar-container">

      <div className="calendar-toolbar">
        <label className="mine-label">
          自分の予約のみ
          <input
            type="checkbox"
            className="mine-checkbox"
            checked={filterMine}
            onChange={e => onFilterMineChange && onFilterMineChange(e.target.checked)}
          />
        </label>
      </div>

      <DailyLedgerView
        date={ledgerDate}
        filterMine={filterMine}
        onFilterMineChange={onFilterMineChange}
        onDateChange={handleLedgerDateChange}
        onCellClick={onLedgerCellClick}
        onReservationClick={onReservationClick}
      />
    </div>
  );
};

export default CalendarComponent;
