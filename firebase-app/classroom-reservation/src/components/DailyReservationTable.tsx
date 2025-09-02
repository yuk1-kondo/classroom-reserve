// 日別予約表示テーブルコンポーネント
import React, { useState, useEffect } from 'react';
import { 
  roomsService, 
  reservationsService, 
  Room, 
  Reservation
} from '../firebase/firestore';
import { dayRange } from '../utils/dateRange';
import { Timestamp } from 'firebase/firestore';
import './DailyReservationTable.css';
import { formatPeriodDisplay, displayLabel } from '../utils/periodLabel'; // 追加
import { PERIOD_ORDER } from '../firebase/firestore';

interface DailyReservationTableProps {
  selectedDate?: string;
  showWhenEmpty?: boolean; // 追加: 空でも表示
}

interface RoomReservationStatus {
  room: Room;
  reservations: Reservation[];
  isEmpty: boolean;
}

export const DailyReservationTable: React.FC<DailyReservationTableProps> = ({
  selectedDate,
  showWhenEmpty = false
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<RoomReservationStatus[]>([]);
  const [sortedReservations, setSortedReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [filterRoomId, setFilterRoomId] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  // 教室データを取得
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const roomsData = await roomsService.getAllRooms();
        setRooms(roomsData);
      } catch (error) {
        console.error('教室データ取得エラー:', error);
        setError('教室データの取得に失敗しました');
      }
    };
    
    loadRooms();
  }, []);

  // 選択日の予約データを取得（予約本体のみ）
  useEffect(() => {
    if (!selectedDate || rooms.length === 0) {
      setRoomStatuses([]);
      return;
    }

    const loadDayReservations = async () => {
      try {
        setLoading(true);
        setError('');
        
  const { start: startOfDay, end: endOfDay } = dayRange(selectedDate);
        
        // 指定日の全予約を取得（ロックは表示しない）
        const allReservations = await reservationsService.getReservations(startOfDay, endOfDay);

        // 教室名付与と時限順のための補助を統一的に付与（予約＋ロック）
        const mapWithOrder = (reservation: Reservation) => {
          const room = rooms.find(r => r.id === reservation.roomId);
          // 時限の並び順を数値化
          let periodOrder = 0;
          if (reservation.period === 'lunch') {
            periodOrder = 4.5; // 4限と5限の間
          } else if (reservation.period === 'after') {
            periodOrder = 999; // 最後
          } else {
            periodOrder = parseInt(reservation.period) || 0;
          }
          return {
            ...reservation,
            roomName: room?.name || '不明',
            periodOrder
          } as any;
        };

        // 予約（本体）のみ
        let combined = allReservations.map(mapWithOrder);

        // フィルター適用
        combined = combined.filter(r =>
          (filterRoomId === 'all' || r.roomId === filterRoomId) &&
          (filterPeriod === 'all' || String(r.period) === String(filterPeriod))
        );

        // 時限順でソート
        combined.sort((a, b) => {
          if (a.periodOrder !== b.periodOrder) {
            return a.periodOrder - b.periodOrder;
          }
          // 同じ時限の場合は教室名でソート
          return a.roomName.localeCompare(b.roomName);
        });

        // 教室ごとの予約状況
        const statuses: RoomReservationStatus[] = [];
        rooms.forEach(room => {
          const roomReservations = combined.filter(res => res.roomId === room.id);
          if (roomReservations.length > 0) {
            statuses.push({ room, reservations: roomReservations as Reservation[], isEmpty: false });
          }
        });

        // 教室名でソート
        statuses.sort((a, b) => a.room.name.localeCompare(b.room.name));

  setRoomStatuses(statuses);
  // 時限順ソート済み（予約＋ロック）の予約リストも保存
  setSortedReservations(combined);
      } catch (error) {
        console.error('予約データ取得エラー:', error);
        setError('予約データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadDayReservations();
  }, [selectedDate, rooms, filterRoomId, filterPeriod]);

  // 日付フォーマット
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 時刻フォーマット
  const formatTime = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!selectedDate) {
    return null;
  }
  if (roomStatuses.length === 0 && !showWhenEmpty) {
    return null; // 従来挙動
  }

  return (
    <div className="daily-reservation-table">
      <div className="table-header">
        <h4>📋 {formatDate(selectedDate)} の予約状況</h4>
        {/* フィルター（ヘッダー右側） */}
        <div className="filters">
          <label>
            教室:
            <select value={filterRoomId} onChange={e => setFilterRoomId(e.target.value)}>
              <option value="all">すべて</option>
              {rooms.map(r => (
                <option key={String(r.id)} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </label>
          <label>
            時限:
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
              <option value="all">すべて</option>
              {PERIOD_ORDER.map(p => (
                <option key={String(p)} value={String(p)}>{displayLabel(String(p))}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* メッセージ行 */}
      {loading && <div className="loading-inline">読み込み中...</div>}
      {error && <div className="error-inline">{error}</div>}
      {!loading && !error && roomStatuses.length === 0 && (
        <div className="no-reservations-inline">予約はありません</div>
      )}

      <div className="table-scroll-container">
        <div className="table-wrapper">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="col-period">時限</th>
                <th className="col-room">教室</th>
                <th className="col-time">時間</th>
                <th className="col-title">予約内容</th> {/* 予約タイトル -> 予約内容 */}
                <th className="col-user">予約者</th>
              </tr>
            </thead>
            <tbody>
              {sortedReservations.map((reservation, index) => {
                const timeStart = formatTime(reservation.startTime);
                const timeEnd = formatTime(reservation.endTime);
                return (
                  <tr key={`${reservation.roomId}-${reservation.id || index}`}>
                    <td className="col-period">
                      <span className="period-badge">{formatPeriodDisplay(reservation.period, reservation.periodName)}</span>
                    </td>
                    <td className="col-room">
                      <div className="room-name">{reservation.roomName}</div>
                    </td>
                    <td className="col-time">
                      <div className="time-range">{timeStart}-{timeEnd}</div>
                    </td>
                    <td className="col-title">
                      <div className="reservation-title">{reservation.title}</div> {/* 表示そのまま */}
                    </td>
                    <td className="col-user">
                      <div className="reservation-user">{reservation.reservationName}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyReservationTable;
