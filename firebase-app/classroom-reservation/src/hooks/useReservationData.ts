// 予約データ管理用カスタムフック
import { useState, useEffect, useCallback } from 'react';
import { roomsService, reservationsService, Room, Reservation } from '../firebase/firestore';
import { dayRange } from '../utils/dateRange';
import { AuthUser } from '../firebase/auth';

export const useReservationData = (currentUser: AuthUser | null, selectedDate?: string) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  // 教室データを取得
  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      const roomsData = await roomsService.getAllRooms();
      
      // より厳密な重複排除（nameで重複チェック）
      const uniqueRooms = roomsData.filter((room, index, arr) => 
        arr.findIndex(r => r.name === room.name) === index
      );
      
      console.log('取得した教室データ:', roomsData.length, '件');
      console.log('重複排除後:', uniqueRooms.length, '件');
      
      setRooms(uniqueRooms);
      return uniqueRooms;
    } catch (error) {
      console.error('教室データ取得エラー:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // 指定日の予約を取得
  const loadReservationsForDate = useCallback(async (date: string) => {
    try {
      console.log('🔍 loadReservationsForDate: 開始', date);
      setLoading(true);
      const { start: startOfDay, end: endOfDay } = dayRange(date);
      
      console.log('🔍 loadReservationsForDate: 検索範囲', { startOfDay, endOfDay });

      const reservationsData = await reservationsService.getReservations(startOfDay, endOfDay);
      console.log('🔍 loadReservationsForDate: 取得結果', { count: reservationsData.length, data: reservationsData });
  
  // スロット取得は削除（予約データから直接競合チェック可能）
  setReservations(reservationsData);
      return reservationsData;
    } catch (error) {
      console.error('予約データ取得エラー:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // 教室データを読み込み
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // 選択日が変更されたときの処理
  useEffect(() => {
    console.log('🔍 useReservationData: selectedDate変更検知:', selectedDate);
    if (selectedDate) {
      console.log('🔍 useReservationData: loadReservationsForDate呼び出し開始');
      loadReservationsForDate(selectedDate);
    } else {
      console.log('🔍 useReservationData: selectedDateが空のため予約データクリア');
      setReservations([]);
    }
  }, [selectedDate, loadReservationsForDate]);

  return {
    rooms,
    reservations,
    loading,
    loadRooms,
    loadReservationsForDate,
    setRooms,
    setReservations
  };
};
