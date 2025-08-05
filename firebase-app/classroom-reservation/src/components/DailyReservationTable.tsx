// 日別予約表示テーブルコンポーネント
import React, { useState, useEffect } from 'react';
import { 
  roomsService, 
  reservationsService, 
  Room, 
  Reservation,
  periodTimeMap 
} from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import './DailyReservationTable.css';

interface DailyReservationTableProps {
  selectedDate?: string;
}

interface RoomReservationStatus {
  room: Room;
  reservations: Reservation[];
  isEmpty: boolean;
}

export const DailyReservationTable: React.FC<DailyReservationTableProps> = ({
  selectedDate
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<RoomReservationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

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

  // 選択日の予約データを取得
  useEffect(() => {
    if (!selectedDate || rooms.length === 0) {
      setRoomStatuses([]);
      return;
    }

    const loadDayReservations = async () => {
      try {
        setLoading(true);
        setError('');
        
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        // 指定日の全予約を取得
        const allReservations = await reservationsService.getReservations(startOfDay, endOfDay);
        
        // 教室ごとの予約状況を整理（予約がある教室のみ）
        const statuses: RoomReservationStatus[] = [];
        
        rooms.forEach(room => {
          const roomReservations = allReservations.filter(res => res.roomId === room.id);
          if (roomReservations.length > 0) {
            statuses.push({
              room,
              reservations: roomReservations,
              isEmpty: false
            });
          }
        });

        // 教室名でソート
        statuses.sort((a, b) => a.room.name.localeCompare(b.room.name));

        setRoomStatuses(statuses);
      } catch (error) {
        console.error('予約データ取得エラー:', error);
        setError('予約データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadDayReservations();
  }, [selectedDate, rooms]);

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

  if (!selectedDate || roomStatuses.length === 0) {
    return null; // 予約がない場合は何も表示しない
  }

  return (
    <div className="daily-reservation-table">
      <div className="table-header">
        <h4>📋 {formatDate(selectedDate)} の予約状況</h4>
        {loading && <div className="loading-indicator">読み込み中...</div>}
        {error && <div className="error-message">{error}</div>}
      </div>

      <table className="excel-table">
        <thead>
          <tr>
            <th className="col-room">教室</th>
            <th className="col-period">時限</th>
            <th className="col-time">時間</th>
            <th className="col-title">予約タイトル</th>
            <th className="col-user">予約者</th>
          </tr>
        </thead>
        <tbody>
          {roomStatuses.map(status => 
            status.reservations.map((reservation, index) => {
              const timeStart = formatTime(reservation.startTime);
              const timeEnd = formatTime(reservation.endTime);
              return (
                <tr key={`${status.room.id}-${reservation.id || index}`}>
                  <td className="col-room">
                    <div className="room-name">{status.room.name}</div>
                  </td>
                  <td className="col-period">
                    <span className="period-badge">{reservation.periodName}</span>
                  </td>
                  <td className="col-time">
                    <div className="time-range">{timeStart}-{timeEnd}</div>
                  </td>
                  <td className="col-title">
                    <div className="reservation-title">{reservation.title}</div>
                  </td>
                  <td className="col-user">
                    <div className="reservation-user">{reservation.reservationName}</div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DailyReservationTable;
