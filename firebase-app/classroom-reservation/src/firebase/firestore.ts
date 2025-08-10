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
  Timestamp,
  writeBatch // 追加
} from 'firebase/firestore';
import { db } from './config';
import { formatPeriodDisplay, displayLabel } from '../utils/periodLabel';

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

// periodName 正規化（取得/追加両方で利用）
function normalizePeriodName(period: string, periodName: string): string {
  if (!period) return periodName;
  // 複数時限 (カンマ / ハイフン) は常に範囲として再計算
  if (period.includes(',') || period.includes('-')) {
    return formatPeriodDisplay(period, periodName);
  }
  const raw = periodName || '';
  if (period === 'lunch' || /lunch/i.test(raw)) return '昼休み';
  if (period === 'after' || /after/i.test(raw)) return '放課後';
  if (/^\d+$/.test(period)) return displayLabel(period); // `${period}限` と同義
  return periodName;
}

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
      return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as Reservation;
        return {
            id: docSnap.id,
            ...data,
            createdBy: data.createdBy || data.reservationName || 'unknown', // createdBy 補完
            periodName: normalizePeriodName(data.period, data.periodName)
        };
      });
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
      return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as Reservation;
        return {
          id: docSnap.id,
          ...data,
          createdBy: data.createdBy || data.reservationName || 'unknown',
          periodName: normalizePeriodName(data.period, data.periodName)
        };
      });
    } catch (error) {
      console.error('教室予約データ取得エラー:', error);
      throw error;
    }
  },

  // 予約を追加
  async addReservation(reservation: Omit<Reservation, 'id'>): Promise<string> {
    try {
      const fixed = {
        ...reservation,
        periodName: normalizePeriodName(reservation.period, reservation.periodName),
        createdAt: Timestamp.now()
      };
      const docRef = await addDoc(collection(db, RESERVATIONS_COLLECTION), fixed);
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
  async deleteAllReservations(): Promise<void> { // 旧方式（小規模データ向け）
    try {
      console.log('🗑️ 全予約データ削除開始...(旧方式) auth.uid=', (await import('./config')).auth?.currentUser?.uid);
      const querySnapshot = await getDocs(collection(db, RESERVATIONS_COLLECTION));
      if (querySnapshot.docs.length === 0) {
        console.log('削除する予約データがありません');
        return;
      }
      const deletePromises = querySnapshot.docs.map(docRef => deleteDoc(docRef.ref));
      await Promise.all(deletePromises);
      console.log(`✅ ${querySnapshot.docs.length}件の予約データを削除しました`);
    } catch (error) {
      console.error('❌ 全削除エラー:', error);
      throw error;
    }
  },

  // バッチ版一括削除（推奨）: 500件ずつ commit
  async deleteAllReservationsBatch(): Promise<number> {
    try {
      const { auth } = await import('./config');
      console.log('🗑️ 全予約データ(バッチ)削除開始 auth.uid=', auth.currentUser?.uid || 'NONE');
      const snap = await getDocs(collection(db, RESERVATIONS_COLLECTION));
      const total = snap.docs.length;
      console.log('取得ドキュメント総数(collection直):', total);
      if (total === 0) {
        return 0;
      }
      let processed = 0;
      let batch = writeBatch(db);
      let ops = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        ops++; processed++;
        if (ops === 500) {
          await batch.commit();
          console.log(`... 500件コミット (累計 ${processed}/${total})`);
          batch = writeBatch(db); ops = 0;
        }
      }
      if (ops > 0) {
        await batch.commit();
        console.log(`... 残り${ops}件コミット (累計 ${processed}/${total})`);
      }
      console.log(`✅ 一括削除完了 合計 ${processed}件`);
      return processed;
    } catch (error) {
      console.error('❌ バッチ一括削除エラー', error);
      throw error;
    }
  },

  // 追加: startTime 広域レンジで再取得→順次 delete (手動削除が成功するケースに近い)
  async deleteAllReservationsWideRange(): Promise<number> {
    const startDate = new Date(2000,0,1);
    const endDate = new Date(2100,0,1);
    console.log('🔎 WideRange 取得開始', startDate.toISOString(), endDate.toISOString());
    const list = await this.getReservations(startDate, endDate);
    console.log('WideRange ヒット件数:', list.length);
    let deleted = 0;
    for (const r of list) {
      if (r.id) {
        try {
          await this.deleteReservation(r.id);
          deleted++;
        } catch(e) {
          console.warn('個別削除失敗', r.id, e);
        }
      }
    }
    console.log('WideRange 削除完了 件数:', deleted);
    return deleted;
  },

  // デバッグ: 全ID列挙
  async listAllReservationIds(): Promise<string[]> {
    const snap = await getDocs(collection(db, RESERVATIONS_COLLECTION));
    const ids = snap.docs.map(d=>d.id);
    console.log('📄 [DEBUG][RESERVATIONS] 全ID一覧:', ids);
    return ids;
  },

  // 予約IDで取得
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    try {
      const docSnap = await getDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
      if (docSnap.exists()) {
        const data = docSnap.data() as Reservation;
        return {
          id: docSnap.id,
          ...data,
          createdBy: data.createdBy || data.reservationName || 'unknown',
          periodName: normalizePeriodName(data.period, data.periodName)
        };
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
  'lunch': { start: '12:40', end: '13:25', name: '昼休み' }, // 名称変更
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

// 時限の順序
export const PERIOD_ORDER = ['0','1','2','3','4','lunch','5','6','7','after'] as const;
export type PeriodKey = typeof PERIOD_ORDER[number];
