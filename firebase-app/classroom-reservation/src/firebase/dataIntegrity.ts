// クライアント側データ整合性チェック・自動復旧サービス
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './config';

// マスターデータ定義（写真の順番通り）
export const MASTER_ROOMS = [
  { id: 'room-1', name: '小演習室1', description: '少人数での演習・グループワーク向け' },
  { id: 'room-2', name: '小演習室2', description: '少人数での演習・グループワーク向け' },
  { id: 'room-3', name: '小演習室3', description: '少人数での演習・グループワーク向け' },
  { id: 'room-4', name: '小演習室4', description: '少人数での演習・グループワーク向け' },
  { id: 'room-5', name: '小演習室5', description: '少人数での演習・グループワーク向け' },
  { id: 'room-6', name: '小演習室6', description: '少人数での演習・グループワーク向け' },
  { id: 'room-7', name: '大演習室1', description: '大人数での演習・講義向け' },
  { id: 'room-8', name: '大演習室2', description: '大人数での演習・講義向け' },
  { id: 'room-9', name: '大演習室3', description: '大人数での演習・講義向け' },
  { id: 'room-10', name: '大演習室4', description: '大人数での演習・講義向け' },
  { id: 'room-11', name: '大演習室5', description: '大人数での演習・講義向け' },
  { id: 'room-12', name: '大演習室6', description: '大人数での演習・講義向け' },
  { id: 'room-13', name: 'サテライト', description: 'サテライト授業・遠隔授業向け' },
  { id: 'room-14', name: '会議室', description: '会議・打ち合わせ向け' },
  { id: 'room-15', name: '社会科教室', description: '社会科授業・専門授業向け' },
  { id: 'room-16', name: 'グローバル教室①', description: '国際教育・語学学習向け' },
  { id: 'room-17', name: 'グローバル教室②', description: '国際教育・語学学習向け' },
  { id: 'room-18', name: 'LL教室', description: '語学学習・リスニング向け' },
  { id: 'room-19', name: 'モノラボ', description: 'ものづくり・実習向け' },
  { id: 'room-20', name: '視聴覚教室', description: '視聴覚教材・プレゼンテーション向け' },
  { id: 'room-21', name: '多目的室', description: '多様な用途・イベント向け' }
];

export const MASTER_PERIODS = [
  { id: '0', name: '0限', startTime: '07:30', endTime: '08:30', order: 0 },
  { id: '1', name: '1限', startTime: '08:50', endTime: '09:40', order: 1 },
  { id: '2', name: '2限', startTime: '09:50', endTime: '10:40', order: 2 },
  { id: '3', name: '3限', startTime: '10:50', endTime: '11:40', order: 3 },
  { id: '4', name: '4限', startTime: '11:50', endTime: '12:40', order: 4 },
  { id: 'lunch', name: '昼休み', startTime: '12:40', endTime: '13:25', order: 4.5 },
  { id: '5', name: '5限', startTime: '13:25', endTime: '14:15', order: 5 },
  { id: '6', name: '6限', startTime: '14:25', endTime: '15:15', order: 6 },
  { id: '7', name: '7限', startTime: '15:25', endTime: '16:15', order: 7 },
  { id: 'after', name: '放課後', startTime: '16:25', endTime: '18:00', order: 8 }
];

// データ整合性チェック・自動復旧サービス
export class DataIntegrityService {
  private static instance: DataIntegrityService;
  private isChecking = false;

  static getInstance(): DataIntegrityService {
    if (!DataIntegrityService.instance) {
      DataIntegrityService.instance = new DataIntegrityService();
    }
    return DataIntegrityService.instance;
  }

  // データ整合性チェック
  async checkAndRepairData(): Promise<boolean> {
    if (this.isChecking) return true;
    this.isChecking = true;

    try {
      console.log('🔍 データ整合性チェック開始...');
      
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const periodsSnapshot = await getDocs(collection(db, 'periods'));
      
      const roomsOK = roomsSnapshot.docs.length === MASTER_ROOMS.length;
      const periodsOK = periodsSnapshot.docs.length === MASTER_PERIODS.length;
      
      console.log(`📚 教室データ: ${roomsSnapshot.docs.length}/${MASTER_ROOMS.length} ${roomsOK ? '✅' : '⚠️'}`);
      console.log(`⏰ 時限データ: ${periodsSnapshot.docs.length}/${MASTER_PERIODS.length} ${periodsOK ? '✅' : '⚠️'}`);
      
      if (!roomsOK) {
        console.log('🔧 教室データ自動復旧中...');
        await this.setupRooms();
      }
      
      if (!periodsOK) {
        console.log('🔧 時限データ自動復旧中...');
        await this.setupPeriods();
      }
      
      console.log('✅ データ整合性チェック完了');
      return true;
    } catch (error) {
      console.error('❌ データ整合性チェックエラー:', error);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  // 教室データセットアップ
  private async setupRooms(): Promise<void> {
    for (const room of MASTER_ROOMS) {
      try {
        await setDoc(doc(db, 'rooms', room.id), {
          name: room.name,
          description: room.description,
          createdAt: new Date(),
          isActive: true
        });
      } catch (error) {
        console.error(`❌ 教室セットアップエラー (${room.name}):`, error);
      }
    }
  }

  // 時限データセットアップ
  private async setupPeriods(): Promise<void> {
    for (const period of MASTER_PERIODS) {
      try {
        await setDoc(doc(db, 'periods', period.id), {
          name: period.name,
          startTime: period.startTime,
          endTime: period.endTime,
          order: period.order,
          createdAt: new Date(),
          isActive: true
        });
      } catch (error) {
        console.error(`❌ 時限セットアップエラー (${period.name}):`, error);
      }
    }
  }
}

// 自動チェック実行（アプリ起動時）
export const initializeDataIntegrity = async (): Promise<void> => {
  const service = DataIntegrityService.getInstance();
  await service.checkAndRepairData();
};
