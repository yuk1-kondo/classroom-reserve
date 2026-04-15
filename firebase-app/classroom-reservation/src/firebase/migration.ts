// Firestore データ初期化とマイグレーション用スクリプト
import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs,
  Timestamp,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { db } from './config';
import { Room, Reservation, roomsService, reservationsService } from './firestore';

// GASのスプレッドシートデータをFirebaseに移行するための初期データ
export const initialRoomsData: Omit<Room, 'id' | 'createdAt'>[] = [
  { name: '小演習室1', description: '小規模演習室' },
  { name: '小演習室2', description: '小規模演習室' },
  { name: '小演習室3', description: '小規模演習室' },
  { name: '小演習室4', description: '小規模演習室' },
  { name: '小演習室5', description: '小規模演習室' },
  { name: '小演習室6', description: '小規模演習室' },
  { name: '大演習室1', description: '大規模演習室' },
  { name: '大演習室2', description: '大規模演習室' },
  { name: '大演習室3', description: '大規模演習室' },
  { name: '大演習室4', description: '大規模演習室' },
  { name: '大演習室5', description: '大規模演習室' },
  { name: '大演習室6', description: '大規模演習室' },
  { name: 'サテライト', description: 'サテライト教室' },
  { name: '会議室', description: '会議室' },
  { name: '社会科教室', description: '社会科専用教室' },
  { name: 'グローバル教室①', description: 'グローバル教育用教室' },
  { name: 'グローバル教室②', description: 'グローバル教育用教室' },
  { name: 'LL教室', description: 'Language Laboratory' },
  { name: 'モノラボ', description: 'ものづくりラボラトリー' },
  { name: '視聴覚教室', description: '視聴覚設備完備教室' },
  { name: '多目的室', description: '多目的利用可能' }
];

/** 理科グループ専用として追加する実験室（Step 3）。既存教室と同名なら scienceGroupOnly を付与する */
export const SCIENCE_LAB_ROOMS: Omit<Room, 'id' | 'createdAt'>[] = [
  { name: '生物実験室', description: '生物実験用（理科グループ専用）', scienceGroupOnly: true },
  { name: '化学実験室', description: '化学実験用（理科グループ専用）', scienceGroupOnly: true },
  { name: '物理実験室', description: '物理実験用（理科グループ専用）', scienceGroupOnly: true }
];

// データ移行サービス
export const migrationService = {
  // 教室データの完全リセット・再初期化
  async resetAndInitializeRooms(): Promise<void> {
    try {
      console.log('🏫 教室データ完全リセット開始...');
      
      // 既存のデータを全て削除
      const existingRooms = await roomsService.getAllRooms();
      if (existingRooms.length > 0) {
        console.log('🗑️ 既存教室データを削除中:', existingRooms.length + '件');
        const batch = writeBatch(db);
        const roomsCollectionRef = collection(db, 'rooms');
        
        for (const room of existingRooms) {
          if (room.id) {
            const roomDocRef = doc(roomsCollectionRef, room.id);
            batch.delete(roomDocRef);
          }
        }
        await batch.commit();
        console.log('✅ 既存教室データ削除完了');
      }
      
      // 新しい教室データを追加
      const batch = writeBatch(db);
      const roomsCollectionRef = collection(db, 'rooms');
      
      [...initialRoomsData, ...SCIENCE_LAB_ROOMS].forEach((roomData) => {
        const roomDocRef = doc(roomsCollectionRef);
        batch.set(roomDocRef, {
          ...roomData,
          createdAt: new Date()
        });
      });
      
      await batch.commit();
      console.log('✅ 新しい教室データ初期化完了:', initialRoomsData.length + SCIENCE_LAB_ROOMS.length + '件追加');
    } catch (error) {
      console.error('❌ 教室データリセット・初期化エラー:', error);
      throw error;
    }
  },

  // 教室データの初期化（既存データがある場合はスキップ）
  async initializeRooms(): Promise<void> {
    try {
      console.log('🏫 教室データ初期化開始...');
      
      // 既存のデータを確認
      const existingRooms = await roomsService.getAllRooms();
      if (existingRooms.length > 0) {
        console.log('✅ 既存の教室データが存在します:', existingRooms.length + '件');
        return;
      }
      
      // バッチ処理で教室データを追加
      const batch = writeBatch(db);
      const roomsCollectionRef = collection(db, 'rooms');
      
      [...initialRoomsData, ...SCIENCE_LAB_ROOMS].forEach((roomData) => {
        const roomDocRef = doc(roomsCollectionRef);
        batch.set(roomDocRef, {
          ...roomData,
          createdAt: new Date()
        });
      });
      
      await batch.commit();
      console.log('✅ 教室データ初期化完了:', initialRoomsData.length + SCIENCE_LAB_ROOMS.length + '件追加');
    } catch (error) {
      console.error('❌ 教室データ初期化エラー:', error);
      throw error;
    }
  },

  /**
   * 生物・化学・物理実験室を追加（同名教室があれば scienceGroupOnly 等を付与）。
   * 既に理科専用として登録済みの場合はスキップ。
   */
  async ensureScienceLabRooms(): Promise<{ added: string[]; updated: string[]; skipped: string[] }> {
    const added: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const existing = await roomsService.getAllRooms();
    for (const template of SCIENCE_LAB_ROOMS) {
      const hit = existing.find(r => r.name === template.name);
      if (hit?.id) {
        if (hit.scienceGroupOnly === true) {
          skipped.push(template.name);
        } else {
          await updateDoc(doc(db, 'rooms', hit.id), {
            scienceGroupOnly: true,
            description: template.description,
            capacity: deleteField()
          });
          updated.push(template.name);
        }
      } else {
        await roomsService.addRoom(template);
        added.push(template.name);
      }
    }
    roomsService.clearRoomsCache();
    return { added, updated, skipped };
  },

  // 全予約データ削除
  async deleteAllReservations(): Promise<void> {
    try {
      console.log('🗑️ 全予約データ削除開始...');
      const deletedCount = await reservationsService.deleteAllReservations();
      console.log(`✅ 全予約データ削除完了: ${deletedCount}件`);
    } catch (error) {
      console.error('❌ 予約データ削除エラー:', error);
      throw error;
    }
  },

  // 教室と予約の完全リセット
  async fullReset(): Promise<void> {
    try {
      console.log('🔄 データ完全リセット開始...');
      
      // 予約データを削除
      await this.deleteAllReservations();
      
      // 教室データをリセット
      await this.resetAndInitializeRooms();
      
      console.log('✅ データ完全リセット完了');
    } catch (error) {
      console.error('❌ データ完全リセットエラー:', error);
      throw error;
    }
  },

  // サンプル予約データの作成（削除予定）
  async createSampleReservations(): Promise<void> {
    try {
      console.log('📅 サンプル予約データ作成開始...');
      
      const rooms = await roomsService.getAllRooms();
      if (rooms.length === 0) {
        throw new Error('教室データが存在しません。先に教室を初期化してください。');
      }
      
      // 今週のサンプル予約を作成
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // 月曜日
      
      const sampleReservations: Omit<Reservation, 'id' | 'createdAt'>[] = [
        // 月曜日
        {
          roomId: rooms[0].id!,
          roomName: rooms[0].name,
          title: '基礎数学',
          reservationName: '田中先生',
          startTime: Timestamp.fromDate(this.createTimeFromPeriod(currentWeekStart, '1')),
          endTime: Timestamp.fromDate(this.createTimeFromPeriod(currentWeekStart, '1', true)),
          period: '1',
          periodName: '1限',
          createdBy: 'system'
        },
        {
          roomId: rooms[1].id!,
          roomName: rooms[1].name,
          title: 'プログラミング基礎',
          reservationName: '佐藤先生',
          startTime: Timestamp.fromDate(this.createTimeFromPeriod(currentWeekStart, '2')),
          endTime: Timestamp.fromDate(this.createTimeFromPeriod(currentWeekStart, '2', true)),
          period: '2',
          periodName: '2限',
          createdBy: 'system'
        },
        // 火曜日（+1日）
        {
          roomId: rooms[0].id!,
          roomName: rooms[0].name,
          title: '英語コミュニケーション',
          reservationName: 'Johnson先生',
          startTime: Timestamp.fromDate(this.createTimeFromPeriod(new Date(currentWeekStart.getTime() + 24*60*60*1000), '3')),
          endTime: Timestamp.fromDate(this.createTimeFromPeriod(new Date(currentWeekStart.getTime() + 24*60*60*1000), '3', true)),
          period: '3',
          periodName: '3限',
          createdBy: 'system'
        },
        // 水曜日（+2日）
        {
          roomId: rooms[2].id!,
          roomName: rooms[2].name,
          title: '学生会議',
          reservationName: '学生会',
          startTime: Timestamp.fromDate(this.createTimeFromPeriod(new Date(currentWeekStart.getTime() + 2*24*60*60*1000), 'after')),
          endTime: Timestamp.fromDate(this.createTimeFromPeriod(new Date(currentWeekStart.getTime() + 2*24*60*60*1000), 'after', true)),
          period: 'after',
          periodName: '放課後',
          createdBy: 'system'
        }
      ];
      
      // バッチ処理で予約データを追加
      const batch = writeBatch(db);
      const reservationsCollectionRef = collection(db, 'reservations');
      
      sampleReservations.forEach((reservationData) => {
        const reservationDocRef = doc(reservationsCollectionRef);
        batch.set(reservationDocRef, {
          ...reservationData,
          createdAt: new Date()
        });
      });
      
      await batch.commit();
      console.log('✅ サンプル予約データ作成完了:', sampleReservations.length + '件追加');
    } catch (error) {
      console.error('❌ サンプル予約データ作成エラー:', error);
      throw error;
    }
  },

  // 時限から時刻を作成するヘルパー
  createTimeFromPeriod(date: Date, period: string, isEnd: boolean = false): Date {
    const periodTimeMap: { [key: string]: { start: string; end: string } } = {
      '1': { start: '08:30', end: '09:20' },
      '2': { start: '09:30', end: '10:20' },
      '3': { start: '10:30', end: '11:20' },
      '4': { start: '11:30', end: '12:20' },
      '5': { start: '13:20', end: '14:10' },
      '6': { start: '14:20', end: '15:10' },
      '7': { start: '15:20', end: '16:10' },
      'after': { start: '16:20', end: '18:30' }
    };
    
    const timeInfo = periodTimeMap[period];
    if (!timeInfo) {
      throw new Error(`不正な時限: ${period}`);
    }
    
    const time = isEnd ? timeInfo.end : timeInfo.start;
    const [hours, minutes] = time.split(':').map(Number);
    
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  },

  // 全データをリセット（開発用）
  async resetAllData(): Promise<void> {
    try {
      console.log('🔄 全データリセット開始...');
      
      // 教室データを削除
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const roomsBatch = writeBatch(db);
      roomsSnapshot.docs.forEach(doc => {
        roomsBatch.delete(doc.ref);
      });
      await roomsBatch.commit();
      
      // 予約データを削除
      const reservationsSnapshot = await getDocs(collection(db, 'reservations'));
      const reservationsBatch = writeBatch(db);
      reservationsSnapshot.docs.forEach(doc => {
        reservationsBatch.delete(doc.ref);
      });
      await reservationsBatch.commit();
      
      console.log('✅ 全データリセット完了');
    } catch (error) {
      console.error('❌ データリセットエラー:', error);
      throw error;
    }
  },

  // 完全な初期化（リセット→教室作成→サンプル予約作成）
  async fullInitialization(): Promise<void> {
    try {
      console.log('🚀 完全初期化開始...');
      
      await this.resetAllData();
      await this.initializeRooms();
      await this.createSampleReservations();
      
      console.log('🎉 完全初期化完了！');
    } catch (error) {
      console.error('❌ 完全初期化エラー:', error);
      throw error;
    }
  }
};
