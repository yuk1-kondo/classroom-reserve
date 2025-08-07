// Firestore データベース操作用のサービス
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';

// 教室の型定義
export interface Room {
  id?: string;
  name: string;
  description?: string;
  capacity?: number;
  createdAt?: Timestamp;
}

// 予約の型定義
export interface Reservation {
  id?: string;
  roomId: string;
  roomName: string;
  title: string;
  reservationName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  period: string;
  periodName: string;
  createdAt?: Timestamp;
  createdBy?: string;
}

// コレクション名
const ROOMS_COLLECTION = 'rooms';
const RESERVATIONS_COLLECTION = 'reservations';

// 教室関連の操作
export const roomsService = {
  // 全教室を取得
  async getAllRooms(): Promise<Room[]> {
    try {
      const querySnapshot = await getDocs(collection(db, ROOMS_COLLECTION));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Room));
    } catch (error) {
      console.error('教室データ取得エラー:', error);
      throw error;
    }
  },

  // 教室を追加
  async addRoom(room: Omit<Room, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, ROOMS_COLLECTION), {
        ...room,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('教室追加エラー:', error);
      throw error;
    }
  }
};

// 予約関連の操作
export const reservationsService = {
  // 期間内の予約を取得
  async getReservations(startDate: Date, endDate: Date): Promise<Reservation[]> {
    try {
      const q = query(
        collection(db, RESERVATIONS_COLLECTION),
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        orderBy('startTime', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reservation));
    } catch (error) {
      console.error('予約データ取得エラー:', error);
      throw error;
    }
  },

  // 特定教室の予約を取得
  async getRoomReservations(roomId: string, startDate: Date, endDate: Date): Promise<Reservation[]> {
    try {
      const q = query(
        collection(db, RESERVATIONS_COLLECTION),
        where('roomId', '==', roomId),
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        orderBy('startTime', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reservation));
    } catch (error) {
      console.error('教室予約データ取得エラー:', error);
      throw error;
    }
  },

  // 予約を追加
  async addReservation(reservation: Omit<Reservation, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, RESERVATIONS_COLLECTION), {
        ...reservation,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('予約追加エラー:', error);
      throw error;
    }
  },

  // 予約を更新
  async updateReservation(reservationId: string, updates: Partial<Reservation>): Promise<void> {
    try {
      await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), updates);
    } catch (error) {
      console.error('予約更新エラー:', error);
      throw error;
    }
  },

  // 予約を削除
  async deleteReservation(reservationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
    } catch (error) {
      console.error('予約削除エラー:', error);
      throw error;
    }
  },

  // 管理者機能：全ての予約を削除
  async deleteAllReservations(): Promise<void> {
    try {
      console.log('🗑️ 全予約データ削除開始...');
      const querySnapshot = await getDocs(collection(db, RESERVATIONS_COLLECTION));
      
      if (querySnapshot.docs.length === 0) {
        console.log('削除する予約データがありません');
        return;
      }

      // 全てのドキュメントを削除
      const deletePromises = querySnapshot.docs.map(docRef => deleteDoc(docRef.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${querySnapshot.docs.length}件の予約データを削除しました`);
    } catch (error) {
      console.error('❌ 全削除エラー:', error);
      throw error;
    }
  },

  // 管理者機能：月毎の予約を削除
  async deleteReservationsByMonth(monthStr: string): Promise<void> {
    try {
      // "2025-01" -> 2025年1月の開始と終了
      const [year, month] = monthStr.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      const q = query(
        collection(db, RESERVATIONS_COLLECTION),
        where('startTime', '>=', Timestamp.fromDate(startOfMonth)),
        where('startTime', '<=', Timestamp.fromDate(endOfMonth))
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length === 0) {
        console.log(`${monthStr}に削除する予約データがありません`);
        return;
      }

      const deletePromises = querySnapshot.docs.map(docRef => deleteDoc(docRef.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${monthStr}の${querySnapshot.docs.length}件の予約データを削除しました`);
    } catch (error) {
      console.error('❌ 月毎削除エラー:', error);
      throw error;
    }
  },

  // 予約IDで取得
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    try {
      const docSnap = await getDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Reservation;
      }
      return null;
    } catch (error) {
      console.error('予約取得エラー:', error);
      throw error;
    }
  },

  // 特定日の予約を取得
  async getDayReservations(date: Date): Promise<Reservation[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return await this.getReservations(startOfDay, endOfDay);
    } catch (error) {
      console.error('日別予約取得エラー:', error);
      throw error;
    }
  }
};

// 時限マッピング（正しい時間設定）
export const periodTimeMap = {
  '0': { start: '07:30', end: '08:30', name: '0限' },
  '1': { start: '08:50', end: '09:40', name: '1限' },
  '2': { start: '09:50', end: '10:40', name: '2限' },
  '3': { start: '10:50', end: '11:40', name: '3限' },
  '4': { start: '11:50', end: '12:40', name: '4限' },
  'lunch': { start: '12:40', end: '13:25', name: 'お昼休み' },
  '5': { start: '13:25', end: '14:15', name: '5限' },
  '6': { start: '14:25', end: '15:15', name: '6限' },
  '7': { start: '15:25', end: '16:15', name: '7限' },
  'after': { start: '16:25', end: '18:00', name: '放課後' }
};

// 時限から日時を作成するヘルパー関数
export function createDateTimeFromPeriod(dateStr: string, period: string) {
  const times = periodTimeMap[period as keyof typeof periodTimeMap];
  if (!times) return null;
  
  const startDateTime = new Date(`${dateStr}T${times.start}:00`);
  const endDateTime = new Date(`${dateStr}T${times.end}:00`);
  
  return {
    start: startDateTime,
    end: endDateTime,
    periodName: times.name
  };
}
