// 統合データセットアップ・メンテナンススクリプト
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } = require('firebase/firestore');

// Firebase設定（環境変数から注入）
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'owa-cbs.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'owa-cbs',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'owa-cbs.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 教室データ（不変マスターデータ）
const ROOMS_DATA = [
  { id: 'room-1', name: '小演習室1', capacity: 20, description: '少人数での演習・グループワーク向け' },
  { id: 'room-2', name: '小演習室2', capacity: 20, description: '少人数での演習・グループワーク向け' },
  { id: 'room-3', name: '小演習室3', capacity: 20, description: '少人数での演習・グループワーク向け' },
  { id: 'room-4', name: '小演習室4', capacity: 20, description: '少人数での演習・グループワーク向け' },
  { id: 'room-5', name: '小演習室5', capacity: 20, description: '少人数での演習・グループワーク向け' },
  { id: 'room-6', name: '小演習室6', capacity: 20, description: '少人数での演習・グループワーク向け' },
  { id: 'room-7', name: '大演習室1', capacity: 40, description: '大人数での演習・講義向け' },
  { id: 'room-8', name: '大演習室2', capacity: 40, description: '大人数での演習・講義向け' },
  { id: 'room-9', name: '大演習室3', capacity: 40, description: '大人数での演習・講義向け' },
  { id: 'room-10', name: '大演習室4', capacity: 40, description: '大人数での演習・講義向け' },
  { id: 'room-11', name: '大演習室5', capacity: 40, description: '大人数での演習・講義向け' },
  { id: 'room-12', name: '大演習室6', capacity: 40, description: '大人数での演習・講義向け' },
  { id: 'room-13', name: 'サテライト', capacity: 30, description: 'サテライト授業・遠隔授業向け' },
  { id: 'room-14', name: '会議室', capacity: 15, description: '会議・打ち合わせ向け' },
  { id: 'room-15', name: '社会科教室', capacity: 35, description: '社会科授業・専門授業向け' },
  { id: 'room-16', name: 'グローバル教室①', capacity: 30, description: '国際教育・語学学習向け' },
  { id: 'room-17', name: 'グローバル教室②', capacity: 30, description: '国際教育・語学学習向け' },
  { id: 'room-18', name: 'LL教室', capacity: 25, description: '語学学習・リスニング向け' },
  { id: 'room-19', name: 'モノラボ', capacity: 20, description: 'ものづくり・実習向け' },
  { id: 'room-20', name: '視聴覚教室', capacity: 50, description: '視聴覚教材・プレゼンテーション向け' },
  { id: 'room-21', name: '多目的室', capacity: 35, description: '多様な用途・イベント向け' }
];

// 時限データ（不変マスターデータ）
const PERIODS_DATA = [
  { id: '0', name: '0限', startTime: '07:30', endTime: '08:30', order: 0 },
  { id: '1', name: '1限', startTime: '08:50', endTime: '09:40', order: 1 },
  { id: '2', name: '2限', startTime: '09:50', endTime: '10:40', order: 2 },
  { id: '3', name: '3限', startTime: '10:50', endTime: '11:40', order: 3 },
  { id: '4', name: '4限', startTime: '11:50', endTime: '12:40', order: 4 },
  { id: 'lunch', name: 'お昼休み', startTime: '12:40', endTime: '13:25', order: 4.5 },
  { id: '5', name: '5限', startTime: '13:25', endTime: '14:15', order: 5 },
  { id: '6', name: '6限', startTime: '14:25', endTime: '15:15', order: 6 },
  { id: '7', name: '7限', startTime: '15:25', endTime: '16:15', order: 7 },
  { id: 'after', name: '放課後', startTime: '16:25', endTime: '18:00', order: 8 }
];

// データ確認
async function checkDataIntegrity() {
  console.log('🔍 データ整合性チェック...');
  
  const roomsSnapshot = await getDocs(collection(db, 'rooms'));
  const periodsSnapshot = await getDocs(collection(db, 'periods'));
  
  console.log(`📚 教室数: ${roomsSnapshot.docs.length}/${ROOMS_DATA.length}`);
  console.log(`⏰ 時限数: ${periodsSnapshot.docs.length}/${PERIODS_DATA.length}`);
  
  return {
    roomsCount: roomsSnapshot.docs.length,
    periodsCount: periodsSnapshot.docs.length,
    roomsOK: roomsSnapshot.docs.length === ROOMS_DATA.length,
    periodsOK: periodsSnapshot.docs.length === PERIODS_DATA.length
  };
}

// 教室データセットアップ
async function setupRooms() {
  console.log('🏫 教室データセットアップ中...');
  
  for (const room of ROOMS_DATA) {
    try {
      await setDoc(doc(db, 'rooms', room.id), {
        name: room.name,
        capacity: room.capacity,
        description: room.description,
        createdAt: new Date(),
        isActive: true
      });
      console.log(`✅ ${room.name} セットアップ完了`);
    } catch (error) {
      console.error(`❌ ${room.name} セットアップエラー:`, error);
    }
  }
}

// 時限データセットアップ
async function setupPeriods() {
  console.log('⏰ 時限データセットアップ中...');
  
  for (const period of PERIODS_DATA) {
    try {
      await setDoc(doc(db, 'periods', period.id), {
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        order: period.order,
        createdAt: new Date(),
        isActive: true
      });
      console.log(`✅ ${period.name} セットアップ完了`);
    } catch (error) {
      console.error(`❌ ${period.name} セットアップエラー:`, error);
    }
  }
}

// 全データリセット
async function resetAllData() {
  console.log('🗑️ 全データリセット中...');
  
  // 既存データ削除
  const collections = ['rooms', 'periods', 'reservations'];
  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName));
    for (const docRef of snapshot.docs) {
      await deleteDoc(docRef.ref);
    }
    console.log(`🗑️ ${collectionName} コレクション削除完了`);
  }
}

// メイン実行
async function main() {
  const command = process.argv[2] || 'check';
  
  try {
    switch (command) {
      case 'check':
        const status = await checkDataIntegrity();
        if (status.roomsOK && status.periodsOK) {
          console.log('✅ データ整合性OK');
        } else {
          console.log('⚠️ データ不整合検出 - 復旧が必要');
        }
        break;
        
      case 'setup':
        console.log('🔧 初期データセットアップ開始...');
        await setupRooms();
        await setupPeriods();
        console.log('🎉 初期データセットアップ完了');
        break;
        
      case 'reset':
        console.log('🔄 データリセット&再セットアップ開始...');
        await resetAllData();
        await setupRooms();
        await setupPeriods();
        console.log('🎉 データリセット&再セットアップ完了');
        break;
        
      default:
        console.log('使用方法: node data-manager.js [check|setup|reset]');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

main();
