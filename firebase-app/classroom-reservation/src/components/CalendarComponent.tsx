// カレンダーコンポーネント
import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  roomsService, 
  reservationsService, 
  Room,
  Reservation,
  periodTimeMap
} from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import './CalendarComponent.css';

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

export const CalendarComponent: React.FC<CalendarComponentProps> = ({
  onDateClick,
  onEventClick,
  refreshTrigger,
  selectedDate
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastSelectedDate, setLastSelectedDate] = useState<string>(''); // 最後に選択された日付を保持
  const calendarRef = useRef<FullCalendar>(null);

  // 教室データを取得
  useEffect(() => {
    const loadRooms = async () => {
      try {
        console.log('📚 CalendarComponent: 教室データ取得開始...');
        setError('');
        const roomsData = await roomsService.getAllRooms();
        setRooms(roomsData);
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

  // 期間表示を整形（カレンダー用）
  const formatPeriodForCalendar = (period: string): string => {
    // 連続時限の場合（例：period1-period6）
    if (period.includes('-')) {
      const [start, end] = period.split('-');
      const startName = periodTimeMap[start as keyof typeof periodTimeMap]?.name || start;
      const endName = periodTimeMap[end as keyof typeof periodTimeMap]?.name || end;
      return `${startName}〜${endName}`;
    }
    
    // 単一時限の場合
    return periodTimeMap[period as keyof typeof periodTimeMap]?.name || period;
  };

  // 予約データを取得してカレンダーイベントに変換
  const loadEvents = async (startDate: Date, endDate: Date) => {
    try {
      setLoading(true);
      console.log('📅 予約データ取得開始:', startDate, 'から', endDate);
      
      const reservations = await reservationsService.getReservations(startDate, endDate);
      console.log('📅 予約データ取得成功:', reservations.length + '件');
      
      // 予約データをカレンダーイベントに変換
      const calendarEvents: CalendarEvent[] = reservations.map(reservation => {
        // Timestampを Date に変換
        const startTime = reservation.startTime instanceof Timestamp 
          ? reservation.startTime.toDate() 
          : new Date(reservation.startTime);
        const endTime = reservation.endTime instanceof Timestamp 
          ? reservation.endTime.toDate() 
          : new Date(reservation.endTime);
        
        return {
          id: reservation.id!,
          title: `【${formatPeriodForCalendar(reservation.period)}】${reservation.title}`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          roomId: reservation.roomId,
          roomName: reservation.roomName
        };
      });
      
      setEvents(calendarEvents);
      console.log('📅 カレンダーイベント変換完了:', calendarEvents.length + '件');
    } catch (error) {
      console.error('❌ 予約データ取得エラー:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // 日付クリック処理
  const handleDateClick = (dateClickInfo: any) => {
    console.log('📅 日付クリック:', dateClickInfo.dateStr);
    setLastSelectedDate(dateClickInfo.dateStr); // 選択日付を保持
    if (onDateClick) {
      onDateClick(dateClickInfo.dateStr);
    }
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
    loadEvents(dateInfo.start, dateInfo.end);
  };

  // カレンダーを再読み込み
  const refetchEvents = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentRange = calendarApi.view.currentStart;
      const endRange = calendarApi.view.currentEnd;
      loadEvents(currentRange, endRange);
    }
  };

  // refreshTriggerが変更されたときにイベントを再読み込み
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refetchEvents();
    }
  }, [refreshTrigger]);

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
    <div className="calendar-container">
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
        initialView="timeGridWeek"
        locale="ja"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        height="auto"
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
        dayMaxEvents={false}
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
