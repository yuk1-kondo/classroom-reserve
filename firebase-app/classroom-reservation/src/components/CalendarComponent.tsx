// カレンダーコンポーネント
import React, { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import './CalendarComponent.css';
import DailyLedgerView from './DailyLedgerView';
import DailyReservationTable from './DailyReservationTable';
import { toDateStr } from '../utils/dateRange';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { Timestamp } from 'firebase/firestore';
import { formatPeriodDisplay } from '../utils/periodLabel';
import { useAuth } from '../hooks/useAuth';

interface CalendarComponentProps {
  selectedDate?: string;
  filterMine?: boolean;
  onFilterMineChange?: (v: boolean) => void;
  onDateNavigate?: (dateStr: string, origin?: 'calendar' | 'ledger') => void;
  onLedgerCellClick?: (roomId: string, period: string) => void;
  onReservationClick?: (reservationId: string) => void;
  onDateClick?: (dateStr: string) => void;
  onEventClick?: (eventId: string) => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    roomName?: string;
    periodName?: string;
    reservationName?: string;
  };
}

type FullCalendarViewType = 'dayGridMonth';
type CalendarViewType = FullCalendarViewType | 'ledger' | 'daily';

const normalizeDate = (input?: string): string => {
  if (!input) return toDateStr(new Date());
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  try {
    return toDateStr(new Date(input));
  } catch {
    return input.slice(0, 10);
  }
};

// 教室名から色を分類
function classifyRoom(roomName: string): string {
  if (!roomName) return 'room-cat-default';
  if (/^小演習室/.test(roomName)) return 'room-cat-small';
  if (/^大演習室/.test(roomName)) return 'room-cat-large';
  if (/社会|LL|グローバル/.test(roomName)) return 'room-cat-purple';
  if (/モノラボ|視聴覚|多目的/.test(roomName)) return 'room-cat-blue';
  if (/サテライト|会議室/.test(roomName)) return 'room-cat-red';
  return 'room-cat-default';
}

export const CalendarComponent: React.FC<CalendarComponentProps> = ({
  selectedDate,
  filterMine: propFilterMine,
  onFilterMineChange,
  onDateNavigate,
  onLedgerCellClick,
  onReservationClick,
  onDateClick,
  onEventClick
}) => {
  const { isAdmin, currentUser } = useAuth();
  const [displayView, setDisplayView] = useState<CalendarViewType>('ledger');
  const [ledgerDate, setLedgerDate] = useState<string>(() => normalizeDate(selectedDate));
  const [dailyTableDate, setDailyTableDate] = useState<string>(() => normalizeDate(selectedDate));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const filterMine = propFilterMine ?? false;
  const { reservations, setRange } = useMonthlyReservations();
  const calendarRef = useRef<FullCalendar>(null);
  const lastFetchedRangeRef = useRef<{ start: string; end: string } | null>(null);
  const currentUserUid = currentUser?.uid || '';

  useEffect(() => {
    if (selectedDate) {
      setLedgerDate(normalizeDate(selectedDate));
      setDailyTableDate(normalizeDate(selectedDate));
    }
  }, [selectedDate]);

  // 予約データをFullCalendarイベントに変換
  const loadEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const startStr = toDateStr(start);
      const endStr = toDateStr(end);
      
      // 範囲を設定してデータを取得
      setRange(start, end);
      
      // 少し待ってからreservationsを使用
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const calendarEvents: CalendarEvent[] = reservations
        .filter(r => {
          const rStart = r.startTime instanceof Timestamp ? r.startTime.toDate() : new Date(r.startTime as any);
          const dateStr = toDateStr(rStart);
          return dateStr >= startStr && dateStr <= endStr;
        })
        .filter(r => {
          if (!filterMine) return true;
          return r.createdBy === currentUserUid;
        })
        .map(r => {
          const start = r.startTime instanceof Timestamp ? r.startTime.toDate() : new Date(r.startTime as any);
          const end = r.endTime instanceof Timestamp ? r.endTime.toDate() : new Date(r.endTime as any);
          const roomClass = classifyRoom(r.roomName);
          
          return {
            id: r.id || '',
            title: `${r.roomName} ${formatPeriodDisplay(r.period)}`,
            start,
            end,
            backgroundColor: `var(--color-${roomClass})`,
            borderColor: `var(--color-${roomClass})`,
            textColor: '#fff',
            extendedProps: {
              roomName: r.roomName,
              periodName: r.periodName,
              reservationName: r.reservationName
            }
          };
        });
      
      setEvents(calendarEvents);
      lastFetchedRangeRef.current = { start: startStr, end: endStr };
    } catch (error) {
      console.error('イベント読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  }, [reservations, filterMine, setRange, currentUserUid]);

  // FullCalendarの日付範囲変更時
  const handleDatesSet = useCallback((arg: any) => {
    if (displayView === 'dayGridMonth') {
      const start = arg.start;
      const end = arg.end;
      loadEvents(start, end);
    }
  }, [displayView, loadEvents]);

  // FullCalendarの日付クリック
  const handleDateClick = useCallback((arg: any) => {
    const dateStr = arg.dateStr;
    onDateClick?.(dateStr);
  }, [onDateClick]);

  // FullCalendarのイベントクリック
  const handleEventClick = useCallback((arg: any) => {
    const eventId = arg.event.id;
    onEventClick?.(eventId);
  }, [onEventClick]);

  const handleLedgerDateChange = useCallback((nextDate: string) => {
    const normalized = normalizeDate(nextDate);
    setLedgerDate(normalized);
    onDateNavigate?.(normalized, 'ledger');
  }, [onDateNavigate]);

  const handleViewButtonClick = useCallback((view: CalendarViewType) => {
    setDisplayView(view);
    if (view === 'dayGridMonth' && calendarRef.current) {
      // 月表示に切り替えた時にイベントを読み込む
      const calendarApi = calendarRef.current.getApi();
      const start = calendarApi.view.currentStart;
      const end = calendarApi.view.currentEnd;
      loadEvents(start, end);
    }
  }, [loadEvents]);


  return (
    <div className="calendar-container">
      <div className="calendar-toolbar">
        {/* 管理者のみビュー切り替えボタンを表示 */}
        {isAdmin && (
          <div className="view-buttons">
            <button
              className={`view-btn ${displayView === 'ledger' ? 'active' : ''}`}
              onClick={() => handleViewButtonClick('ledger')}
            >
              台帳
            </button>
            <button
              className={`view-btn ${displayView === 'dayGridMonth' ? 'active' : ''}`}
              onClick={() => handleViewButtonClick('dayGridMonth')}
            >
              月
            </button>
            <button
              className={`view-btn ${displayView === 'daily' ? 'active' : ''}`}
              onClick={() => handleViewButtonClick('daily')}
            >
              予約状況
            </button>
          </div>
        )}

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

      {displayView === 'ledger' && (
        <DailyLedgerView
          date={ledgerDate}
          filterMine={filterMine}
          onFilterMineChange={onFilterMineChange}
          onDateChange={handleLedgerDateChange}
          onCellClick={onLedgerCellClick}
          onReservationClick={onReservationClick}
        />
      )}

      {displayView === 'dayGridMonth' && isAdmin && (
        <div className="calendar-wrapper">
          {loading && <div className="calendar-loading">読み込み中...</div>}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            locale="ja"
            buttonText={{
              today: '今日',
              month: '月',
              week: '週',
              day: '日'
            }}
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            dayMaxEvents={3}
            eventDisplay="block"
          />
        </div>
      )}

      {displayView === 'daily' && isAdmin && (
        <DailyReservationTable
          selectedDate={dailyTableDate}
          onDateChange={(date) => {
            setDailyTableDate(date);
            onDateNavigate?.(date);
          }}
          filterMine={filterMine}
          onFilterMineChange={onFilterMineChange}
        />
      )}
    </div>
  );
};

export default CalendarComponent;
