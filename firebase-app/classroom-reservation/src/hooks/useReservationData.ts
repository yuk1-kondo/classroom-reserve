// 予約データ管理用カスタムフック
import { useState, useEffect } from 'react';
import { roomsService, reservationsService, Room, Reservation } from '../firebase/firestore';

export const useReservationData = (selectedDate?: string) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  // 教室データを取得
  const loadRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await roomsService.getAllRooms();
      setRooms(roomsData);
      return roomsData;
    } catch (error) {
      console.error('教室データ取得エラー:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 指定日の予約を取得
  const loadReservationsForDate = async (date: string) => {
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const reservationsData = await reservationsService.getReservations(startOfDay, endOfDay);
      setReservations(reservationsData);
      return reservationsData;
    } catch (error) {
      console.error('予約データ取得エラー:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 初期化時に教室データを読み込み
  useEffect(() => {
    loadRooms();
  }, []);

  // 選択日が変更されたときの処理
  useEffect(() => {
    if (selectedDate) {
      loadReservationsForDate(selectedDate);
    }
  }, [selectedDate]);

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
