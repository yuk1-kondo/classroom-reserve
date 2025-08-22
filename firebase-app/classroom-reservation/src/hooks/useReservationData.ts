// 予約データ管理用カスタムフック
import { useState, useEffect, useCallback } from 'react';
import { roomsService, reservationsService, Room, Reservation, ReservationSlot } from '../firebase/firestore';
import { AuthUser } from '../firebase/auth';

export const useReservationData = (currentUser: AuthUser | null, selectedDate?: string) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [slots, setSlots] = useState<ReservationSlot[]>([]);
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
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0); // 00:00:00から開始
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('🔍 loadReservationsForDate: 検索範囲', { startOfDay, endOfDay });
      
  const reservationsData = await reservationsService.getReservations(startOfDay, endOfDay);
      console.log('🔍 loadReservationsForDate: 取得結果', { count: reservationsData.length, data: reservationsData });
  // 予約と同時にスロットも取得
  const slotsData = await reservationsService.getSlotsForDate(date);
  console.log('🔍 loadReservationsForDate: スロット取得結果', { count: slotsData.length, data: slotsData });

  setReservations(reservationsData);
  setSlots(slotsData);
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
  slots,
    loading,
    loadRooms,
    loadReservationsForDate,
    setRooms,
  setReservations,
  setSlots
  };
};
