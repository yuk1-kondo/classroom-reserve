// 緊急用の簡単データ初期化ツール
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './config';

// Firebase接続テスト
export const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Firebase接続テスト開始...');
    const roomsCollection = collection(db, 'rooms');
    const snapshot = await getDocs(roomsCollection);
    console.log('✅ Firebase接続成功! 教室数:', snapshot.size);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('❌ Firebase接続エラー:', error);
    
    // エラーの詳細情報を提供
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      if (error.message.includes('Missing or insufficient permissions')) {
        console.error('🚫 権限エラー: Firestoreセキュリティルールを確認してください');
        return { success: false, error: 'Firestore権限エラー: セキュリティルールの修正が必要です' };
      }
      if (error.message.includes('Failed to get document')) {
        console.error('🔌 接続エラー: ネットワークまたはFirebase設定を確認してください');
        return { success: false, error: 'Firebase接続エラー: ネットワークまたは設定を確認してください' };
      }
    }
    
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// 簡単な教室データを直接Firestoreに追加
export const simpleInitializeRooms = async () => {
  console.log('🏫 実際の教室データで初期化開始...');
  
  // 実際の教室データ（スプレッドシートから）
  const rooms = [
    { id: 's_practice_01', name: '小演習室1', description: '小規模演習室', capacity: 20 },
    { id: 's_practice_02', name: '小演習室2', description: '小規模演習室', capacity: 20 },
    { id: 's_practice_03', name: '小演習室3', description: '小規模演習室', capacity: 20 },
    { id: 's_practice_04', name: '小演習室4', description: '小規模演習室', capacity: 20 },
    { id: 's_practice_05', name: '小演習室5', description: '小規模演習室', capacity: 20 },
    { id: 's_practice_06', name: '小演習室6', description: '小規模演習室', capacity: 20 },
    { id: 'l_practice_01', name: '大演習室1', description: '大規模演習室', capacity: 40 },
    { id: 'l_practice_02', name: '大演習室2', description: '大規模演習室', capacity: 40 },
    { id: 'l_practice_03', name: '大演習室3', description: '大規模演習室', capacity: 40 },
    { id: 'l_practice_04', name: '大演習室4', description: '大規模演習室', capacity: 40 },
    { id: 'l_practice_05', name: '大演習室5', description: '大規模演習室', capacity: 40 },
    { id: 'l_practice_06', name: '大演習室6', description: '大規模演習室', capacity: 40 },
    { id: 'satellite_n', name: 'サテライト', description: 'サテライト教室', capacity: 30 },
    { id: 'meeting_room', name: '会議室', description: '会議用教室', capacity: 15 },
    { id: 'social_room', name: '社会科教室', description: '社会科専用教室', capacity: 35 },
    { id: 'global_01', name: 'グローバル教室①', description: 'グローバル教育用教室', capacity: 30 },
    { id: 'global_02', name: 'グローバル教室②', description: 'グローバル教育用教室', capacity: 30 },
    { id: 'll_room', name: 'LL教室', description: 'ランゲージラボ', capacity: 25 },
    { id: 'monolab', name: 'モノラボ', description: 'ものづくりラボ', capacity: 20 },
    { id: 'av_room', name: '視聴覚教室', description: 'AV機器完備教室', capacity: 50 },
    { id: 'multi_room', name: '多目的室', description: '多目的利用教室', capacity: 60 }
  ];

  const roomsCollection = collection(db, 'rooms');
  
  for (const room of rooms) {
    try {
      const docRef = await addDoc(roomsCollection, {
        name: room.name,
        description: room.description,
        capacity: room.capacity,
        createdAt: Timestamp.now()
      });
      console.log('✅ 教室追加成功:', room.name, 'ID:', docRef.id);
    } catch (error) {
      console.error('❌ 教室追加エラー:', room.name, error);
      throw error;
    }
  }
  
  console.log('🎉 実際の教室データ初期化完了!');
  return rooms.length;
};
