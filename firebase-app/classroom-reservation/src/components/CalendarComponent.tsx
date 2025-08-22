// カレンダーコンポーネント
import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  roomsService, 
  reservationsService
} from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import './CalendarComponent.css';
import { displayLabel, formatPeriodDisplay } from '../utils/periodLabel';
import { useSystemSettings } from '../hooks/useSystemSettings';

interface CalendarComponentProps {
  onDateClick?: (dateStr: string) => void;
  onEventClick?: (eventId: string) => void;
  refreshTrigger?: number; // 外部からの更新トリガー
  selectedDate?: string; // 選択された日付（表示モード切り替え時に使用）
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  roomId: string;
  roomName: string;
}

export const CalendarComponent: React.FC<CalendarComponentProps> = ({ onDateClick, onEventClick, refreshTrigger, selectedDate }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastSelectedDate, setLastSelectedDate] = useState<string>(''); // 最後に選択された日付を保持
  const calendarRef = useRef<FullCalendar>(null);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const isMobile = windowWidth < 600;
  const [initialView, setInitialView] = useState<string>('timeGridWeek');
  // 直近取得した日付範囲（無限再取得防止）
  const lastFetchedRangeRef = useRef<{ start: number; end: number } | null>(null);
  // 予約上限設定の取得
  const { maxDateStr, limitMonths } = useSystemSettings();

  // 各日のセルに「上限超過」のクラスを付与（表示はするが薄く）
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
    const target = isMobile ? 'dayGridMonth' : 'timeGridWeek';
    setInitialView(target);
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      if (api.view.type !== target) {
        api.changeView(target);
      }
    }
  }, [isMobile]);

  // 予約データを取得してカレンダーイベントに変換
  const loadEvents = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setLoading(true);
      console.log('📅 予約データ取得開始:', startDate, 'から', endDate);
      const reservations = await reservationsService.getReservations(startDate, endDate);
      console.log('📅 予約データ取得成功:', reservations.length + '件');
      const calendarEvents: CalendarEvent[] = reservations.map(reservation => {
         const startTime = reservation.startTime instanceof Timestamp 
           ? reservation.startTime.toDate() 
           : new Date(reservation.startTime);
         const endTime = reservation.endTime instanceof Timestamp 
           ? reservation.endTime.toDate() 
           : new Date(reservation.endTime);
        // 複数時限(カンマ/ハイフン)は範囲表示に整形
        const periodLabel = reservation.period.includes(',') || reservation.period.includes('-')
          ? formatPeriodDisplay(reservation.period, reservation.periodName)
          : displayLabel(reservation.period);
         return {
           id: reservation.id!,
           title: `${periodLabel} ${reservation.roomName}`, // 表記順を『時限 教室名』へ変更
           start: startTime.toISOString(),
           end: endTime.toISOString(),
           roomId: reservation.roomId,
           roomName: reservation.roomName,
           extendedProps: {
             originalTitle: reservation.title,
             period: reservation.period,
             // UI は periodName を使用しないが互換保持
            periodName: periodLabel,
            periodDisplay: periodLabel
           }
         } as any;
       });
      setEvents(calendarEvents);
      console.log('📅 カレンダーイベント変換完了:', calendarEvents.length + '件');
    } catch (error) {
      console.error('❌ 予約データ取得エラー:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 教室データを取得
  useEffect(() => {
    const loadRooms = async () => {
      try {
        console.log('📚 CalendarComponent: 教室データ取得開始...');
        setError('');
        const roomsData = await roomsService.getAllRooms();
        console.log('📚 CalendarComponent: 教室データ取得成功:', roomsData.length + '件', roomsData);
        
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

  // 日付クリック処理
  const handleDateClick = (dateClickInfo: any) => {
    const dateStr = dateClickInfo.dateStr as string;
    console.log('📅 日付クリック:', dateStr);
    // 上限超過はクリック時点でガード（validRangeでも多くは無効化されるが、保険で）
    if (maxDateStr && new Date(dateStr).getTime() > new Date(maxDateStr).getTime()) {
      const msg = limitMonths
        ? `予約は${limitMonths}ヶ月先（${maxDateStr}まで）に制限されています。`
        : `この日は予約できません（上限: ${maxDateStr}）。`;
      alert(msg);
      return;
    }
    setLastSelectedDate(dateStr); // 選択日付を保持
    if (onDateClick) onDateClick(dateStr);
  };

  // ビュー変更時に選択日付に移動
  const handleViewChange = (viewInfo: any) => {
    console.log('📅 ビュー変更:', viewInfo.view.type);
    
    // 選択日付がある場合、そこに移動
    const targetDate = selectedDate || lastSelectedDate;
    if (targetDate && calendarRef.current) {
      console.log('📅 選択日付に移動:', targetDate);
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(targetDate);
    }
  };

  // イベントクリック処理
  const handleEventClick = (eventClickInfo: any) => {
    console.log('📅 イベントクリック:', eventClickInfo.event.id);
    if (onEventClick) {
      onEventClick(eventClickInfo.event.id);
    }
  };

  // カレンダーの日付範囲変更時
  const handleDatesSet = (dateInfo: any) => {
    console.log('📅 カレンダー日付範囲変更:', dateInfo.start, 'から', dateInfo.end);
    const startMs = dateInfo.start.getTime();
    const endMs = dateInfo.end.getTime();
    const prev = lastFetchedRangeRef.current;
    if (prev && prev.start === startMs && prev.end === endMs) {
      console.log('⏭️ 同一日付範囲のため再取得スキップ');
      return;
    }
    lastFetchedRangeRef.current = { start: startMs, end: endMs };
    // 実際の取得
    loadEvents(dateInfo.start, dateInfo.end);
  };

  // カレンダーを再読み込み
  const refetchEvents = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentRange = calendarApi.view.currentStart;
      const endRange = calendarApi.view.currentEnd;
      loadEvents(currentRange, endRange);
    }
  }, [loadEvents, calendarRef]);

  // refreshTriggerが変更されたときにイベントを再読み込み
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refetchEvents();
    }
  }, [refreshTrigger, refetchEvents]);

  // selectedDateが変更されたときに対象日付に移動
  useEffect(() => {
    if (selectedDate && calendarRef.current) {
      console.log('📅 外部から指定された日付に移動:', selectedDate);
      setLastSelectedDate(selectedDate);
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(selectedDate);
    }
  }, [selectedDate]);

  // 外部から呼び出せるように ref を設定
  // useImperativeHandle は削除（不要）

  return (
    <div className={`calendar-container ${isMobile ? 'is-mobile-cal' : ''}`}>
      {loading && (
        <div className="calendar-loading">
          📅 カレンダー読み込み中...
        </div>
      )}
      
      {error && (
        <div className="calendar-error">
          {error}
        </div>
      )}
      
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
  locale="ja"
  dayCellClassNames={dayCellClassNames}
        headerToolbar={isMobile ? {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        } : {
          left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        height={isMobile ? 'auto' : 'auto'}
        expandRows={!isMobile}
        slotMinTime="08:00:00"
        slotMaxTime="19:00:00"
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5], // 月-金
          startTime: '08:30',
          endTime: '18:30',
        }}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        viewDidMount={handleViewChange} // ビュー変更時のハンドラを追加
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
        nowIndicator={true}
        selectable={true}
        selectMirror={true}
        weekends={true}
        editable={false}
        allDaySlot={false}
      />
    </div>
  );
};

export default CalendarComponent;
