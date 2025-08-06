// Firestore初期データセットアップスクリプト
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from './config';

// 初期教室データ
const initialRooms = [
  { name: '小演習室1', description: '小規模演習室', capacity: 20 },
  { name: '小演習室2', description: '小規模演習室', capacity: 20 },
  { name: '小演習室3', description: '小規模演習室', capacity: 20 },
  { name: '小演習室4', description: '小規模演習室', capacity: 20 },
  { name: '小演習室5', description: '小規模演習室', capacity: 20 },
  { name: '小演習室6', description: '小規模演習室', capacity: 20 },
  { name: '大演習室1', description: '大規模演習室', capacity: 40 },
  { name: '大演習室2', description: '大規模演習室', capacity: 40 },
  { name: '大演習室3', description: '大規模演習室', capacity: 40 },
  { name: '大演習室4', description: '大規模演習室', capacity: 40 },
  { name: '大演習室5', description: '大規模演習室', capacity: 40 },
  { name: '大演習室6', description: '大規模演習室', capacity: 40 },
  { name: 'サテライト', description: 'サテライト教室', capacity: 30 },
  { name: '会議室', description: '会議用教室', capacity: 15 },
  { name: '社会科教室', description: '社会科専用教室', capacity: 35 },
  { name: 'グローバル教室①', description: 'グローバル教育用教室', capacity: 30 },
  { name: 'グローバル教室②', description: 'グローバル教育用教室', capacity: 30 },
  { name: 'LL教室', description: 'ランゲージラボ', capacity: 25 },
  { name: 'モノラボ', description: 'ものづくりラボ', capacity: 20 },
  { name: '視聴覚教室', description: 'AV機器完備教室', capacity: 50 },
  { name: '多目的室', description: '多目的利用教室', capacity: 60 }
];

// 初期データセットアップ関数
export const setupInitialData = async () => {
  try {
    console.log('🔧 初期データセットアップを開始...');
    
    // 既存の教室データを確認
    const roomsSnapshot = await getDocs(collection(db, 'rooms'));
    
    if (roomsSnapshot.empty) {
      console.log('📚 教室データを初期化中...');
      
      for (const room of initialRooms) {
        await addDoc(collection(db, 'rooms'), {
          ...room,
          createdAt: new Date()
        });
        console.log(`✅ 教室「${room.name}」を追加`);
      }
      
      console.log('🎉 初期データセットアップ完了！');
      return { success: true, message: '初期データセットアップ完了' };
    } else {
      console.log('📋 教室データは既に存在します');
      return { success: true, message: '教室データは既に存在します' };
    }
  } catch (error) {
    console.error('❌ 初期データセットアップエラー:', error);
    return { success: false, error };
  }
};

// 開発環境での自動実行
if (process.env.NODE_ENV === 'development') {
  // 1秒後に自動実行（Firebase初期化完了を待つ）
  setTimeout(() => {
    setupInitialData();
  }, 1000);
}
