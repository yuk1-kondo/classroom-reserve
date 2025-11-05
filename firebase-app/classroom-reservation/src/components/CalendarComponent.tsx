// カレンダーコンポーネント
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { roomsService } from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import './CalendarComponent.css';
import { displayLabel, formatPeriodDisplay } from '../utils/periodLabel';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { authService } from '../firebase/auth';
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
  if (saved === 'timeGridDay' || saved === 'timeGridWeek' || saved === 'dayGridMonth') {
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
  onDateNavigate
}) => {
  const resolvedInitialCalendarView = useMemo(() => resolveInitialCalendarView(), []);
  const resolvedInitialDisplayView = useMemo(() => resolveInitialDisplayView(), []);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(() => resolvedInitialDisplayView !== 'ledger');
  const [error, setError] = useState<string>('');
  const [lastSelectedDate, setLastSelectedDate] = useState<string>('');
  const calendarRef = useRef<FullCalendar>(null);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const isMobile = windowWidth < 600;
  const [initialView] = useState<FullCalendarViewType>(resolvedInitialCalendarView);
  const [displayView, setDisplayView] = useState<CalendarViewType>(resolvedInitialDisplayView);
  const [ledgerDate, setLedgerDate] = useState<string>(() => normalizeDate(selectedDate));
  const filterMine = propFilterMine ?? false;
  const lastFetchedRangeRef = useRef<{ start: number; end: number } | null>(null);
  const { maxDateStr } = useSystemSettings();
  const isLedgerView = displayView === 'ledger';
  const ledgerModeRef = useRef(isLedgerView);

  useEffect(() => {
    ledgerModeRef.current = isLedgerView;
  }, [isLedgerView]);

  const { reservations, setRange, refetch } = useMonthlyReservations();

  const showCalendarLoading = useCallback(() => {
    if (ledgerModeRef.current) {
      setLoading(false);
      return;
    }
    setLoading(true);
  }, []);

  const hideCalendarLoading = useCallback(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLedgerView) {
      hideCalendarLoading();
    }
  }, [isLedgerView, hideCalendarLoading]);

  const classifyRoom = useCallback((roomName: string): string => {
    if (!roomName) return 'room-cat-default';
    if (/^小演習室/.test(roomName)) return 'room-cat-small';
    if (/^大演習室/.test(roomName)) return 'room-cat-large';
    if (/社会|LL|グローバル/.test(roomName)) return 'room-cat-purple';
    if (/モノラボ|視聴覚|多目的/.test(roomName)) return 'room-cat-blue';
    if (/サテライト|会議室/.test(roomName)) return 'room-cat-red';
    return 'room-cat-default';
  }, []);

  const dayCellClassNames = useCallback((arg: any) => {
    if (!maxDateStr) return [];
    const cellDate: Date = arg.date;
    if (cellDate.getTime() > new Date(maxDateStr).getTime()) {
      return ['fc-day-overlimit'];
    }
    return [];
  }, [maxDateStr]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (displayView === 'ledger') {
      hideCalendarLoading();
      return;
    }
    if (!calendarRef.current) return;
    const api = calendarRef.current.getApi();
    const target = (isMobile ? 'timeGridDay' : 'timeGridWeek') as FullCalendarViewType;
    if (api.view.type === 'dayGridMonth') return;
    if (api.view.type !== target) {
      api.changeView(target);
      setDisplayView(target);
    }
  }, [isMobile, displayView, hideCalendarLoading]);

  const loadEvents = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      if (ledgerModeRef.current) {
        hideCalendarLoading();
        return;
      }
      showCalendarLoading();
      const current = authService.getCurrentUser();
      const base = Array.isArray(reservations) ? reservations : [];
      const filtered = filterMine && current
        ? base.filter(r => r.createdBy === current.uid)
        : base;
      const calendarEvents: CalendarEvent[] = filtered.map(reservation => {
        const startTime = reservation.startTime instanceof Timestamp
          ? reservation.startTime.toDate()
          : new Date(reservation.startTime);
        const endTime = reservation.endTime instanceof Timestamp
          ? reservation.endTime.toDate()
          : new Date(reservation.endTime);
        const periodLabel = reservation.period.includes(',') || reservation.period.includes('-')
          ? formatPeriodDisplay(reservation.period, reservation.periodName)
          : displayLabel(reservation.period);
        return {
          id: reservation.id!,
          title: `${periodLabel} ${reservation.roomName}`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          roomId: reservation.roomId,
          roomName: reservation.roomName,
          extendedProps: {
            originalTitle: reservation.title,
            period: reservation.period,
            periodName: periodLabel,
            periodDisplay: periodLabel
          }
        } as any;
      });
      setEvents(calendarEvents);
    } catch (error) {
      console.error('❌ 予約データ取得エラー:', error);
      setEvents([]);
    } finally {
      hideCalendarLoading();
    }
  }, [filterMine, reservations, hideCalendarLoading, showCalendarLoading]);

  useEffect(() => {
    if (ledgerModeRef.current || !calendarRef.current) {
      hideCalendarLoading();
      return;
    }
    const api = calendarRef.current.getApi();
    const start = api.view.currentStart;
    const end = api.view.currentEnd;
    loadEvents(start, end);
  }, [reservations, loadEvents, hideCalendarLoading, displayView]);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        setError('');
        const roomsData = await roomsService.getAllRooms();
        if (roomsData.length === 0) {
          const message = '⚠️ 教室データが登録されていません。右上のデバッグパネルから「教室初期化」を実行してください。';
          console.warn(message);
          setError(message);
        }
      } catch (error) {
        const errorMessage = '❌ 教室データ取得エラー: ' + (error as Error).message;
        console.error(errorMessage, error);
        setError(errorMessage);
      }
    };

    loadRooms();
  }, []);

  const handleDateClick = (dateClickInfo: any) => {
    const dateStr = dateClickInfo.dateStr as string;
    if (maxDateStr && new Date(dateStr).getTime() > new Date(maxDateStr).getTime()) {
      const msg = `設定した日付（${maxDateStr}）までしか予約できません。`;
      alert(msg);
      return;
    }
    setLastSelectedDate(dateStr);
    onDateNavigate?.(dateStr, 'calendar');
    if (onDateClick) onDateClick(dateStr);
  };

  const handleViewChange = (viewInfo: any) => {
    if (ledgerModeRef.current) return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewInfo.view.type);
    } catch {}
    setDisplayView(viewInfo.view.type as CalendarViewType);

    const targetDate = selectedDate || lastSelectedDate;
    if (targetDate && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(targetDate);
    }
  };

  const handleEventClick = (eventClickInfo: any) => {
    if (onEventClick) {
      onEventClick(eventClickInfo.event.id);
    }
  };

  const handleDatesSet = (dateInfo: any) => {
    if (ledgerModeRef.current) {
      hideCalendarLoading();
      return;
    }
    const startMs = dateInfo.start.getTime();
    const endMs = dateInfo.end.getTime();
    const prev = lastFetchedRangeRef.current;
    if (prev && prev.start === startMs && prev.end === endMs) {
      return;
    }
    lastFetchedRangeRef.current = { start: startMs, end: endMs };
    setRange(dateInfo.start, dateInfo.end);
    loadEvents(dateInfo.start, dateInfo.end);
  };

  const refetchEvents = useCallback(() => {
    if (ledgerModeRef.current) {
      hideCalendarLoading();
      return;
    }
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentRange = calendarApi.view.currentStart;
      const endRange = calendarApi.view.currentEnd;
      loadEvents(currentRange, endRange);
    }
  }, [hideCalendarLoading, loadEvents]);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      if (lastFetchedRangeRef.current) {
        refetch();
        const start = new Date(lastFetchedRangeRef.current.start);
        const end = new Date(lastFetchedRangeRef.current.end);
        loadEvents(start, end);
      } else {
        refetchEvents();
      }
    }
  }, [refreshTrigger, refetchEvents, refetch, loadEvents]);

  useEffect(() => {
    if (lastFetchedRangeRef.current) {
      const start = new Date(lastFetchedRangeRef.current.start);
      const end = new Date(lastFetchedRangeRef.current.end);
      loadEvents(start, end);
    }
  }, [filterMine, loadEvents]);

  useEffect(() => {
    if (selectedDate && calendarRef.current) {
      setLastSelectedDate(selectedDate);
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(selectedDate);
    }
    if (selectedDate) {
      setLedgerDate(normalizeDate(selectedDate));
    }
  }, [selectedDate]);

  const viewButtonLabel: Record<CalendarViewType, string> = {
    timeGridDay: '日',
    timeGridWeek: '週',
    dayGridMonth: '月',
    ledger: '台帳'
  };

  const mineToggleId = React.useId();

  const handleViewSwitch = useCallback((targetView: CalendarViewType) => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, targetView);
    } catch {}
    setDisplayView(targetView);
    if (targetView === 'ledger') {
      const date = selectedDate || lastSelectedDate || normalizeDate(new Date().toISOString().slice(0, 10));
      setLedgerDate(date);
      return;
    }
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      if (api.view.type !== targetView) {
        api.changeView(targetView);
      }
    }
  }, [selectedDate, lastSelectedDate]);

  const handleLedgerDateChange = useCallback((nextDate: string) => {
    const normalized = normalizeDate(nextDate);
    setLedgerDate(normalized);
    onDateNavigate?.(normalized, 'ledger');
  }, [onDateNavigate]);

  return (
    <div className={`calendar-container ${isMobile ? 'is-mobile-cal' : ''}`}>
      {loading && !isLedgerView && (
        <div className="calendar-loading">📅 カレンダー読み込み中...</div>
      )}

      {error && (
        <div className="calendar-error">{error}</div>
      )}

      <div className="calendar-toolbar">
        <div className="calendar-view-switch" role="group" aria-label="表示切替">
          {(['timeGridDay', 'timeGridWeek', 'dayGridMonth', 'ledger'] as CalendarViewType[]).map(view => (
            <button
              key={view}
              type="button"
              className={`view-switch-button ${displayView === view ? 'is-active' : ''}`}
              onClick={() => handleViewSwitch(view)}
              aria-pressed={displayView === view}
            >
              {viewButtonLabel[view]}
            </button>
          ))}
        </div>
        <div className="mine-toggle">
          <input
            id={mineToggleId}
            type="checkbox"
            className="mine-checkbox"
            checked={filterMine}
            onChange={e => onFilterMineChange && onFilterMineChange(e.target.checked)}
          />
          <label htmlFor={mineToggleId}>自分の予約のみ</label>
        </div>
      </div>

      {displayView === 'ledger' ? (
        <DailyLedgerView
          date={ledgerDate}
          filterMine={filterMine}
          onFilterMineChange={onFilterMineChange}
          onDateChange={handleLedgerDateChange}
        />
      ) : (
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={initialView}
          locale="ja"
          dayCellClassNames={dayCellClassNames}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''
          }}
          height={isMobile ? 'auto' : 'auto'}
          expandRows={!isMobile}
          slotMinTime="08:00:00"
          slotMaxTime="19:00:00"
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:30',
            endTime: '18:30'
          }}
          events={events}
          eventClassNames={(arg: any) => [classifyRoom(arg.event.extendedProps?.roomName || '')]}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          viewDidMount={handleViewChange}
          eventDisplay="block"
          displayEventTime={false}
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventTextColor="white"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          nowIndicator
          selectable
          selectMirror
          weekends
          editable={false}
          allDaySlot={false}
        />
      )}
    </div>
  );
};

export default CalendarComponent;
