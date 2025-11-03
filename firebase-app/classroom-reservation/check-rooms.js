const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function checkRooms() {
  console.log('🏫 教室データの確認開始...');
  
  try {
    // 教室コレクションを取得
    const roomsRef = collection(db, 'rooms');
    const snapshot = await getDocs(roomsRef);
    
    console.log(`📊 教室データ件数: ${snapshot.size}件`);
    
    if (snapshot.empty) {
      console.log('❌ 教室データが存在しません');
      return;
    }
    
    // 教室データを表示
    const rooms = [];
    snapshot.forEach(doc => {
      const room = doc.data();
      rooms.push({
        id: doc.id,
        name: room.name,
        description: room.description,
        capacity: room.capacity
      });
    });
    
    // 大演習室5を探す
    const largeRoom5 = rooms.find(room => room.name === '大演習室5');
    if (largeRoom5) {
      console.log('🎯 大演習室5を発見:');
      console.log('  ID:', largeRoom5.id);
      console.log('  名前:', largeRoom5.name);
      console.log('  説明:', largeRoom5.description);
      console.log('  定員:', largeRoom5.capacity);
    } else {
      console.log('❌ 大演習室5は存在しません');
    }
    
    // 大演習室系を全て表示
    console.log('\n🏢 大演習室一覧:');
    const largeRooms = rooms.filter(room => room.name.includes('大演習室'));
    largeRooms.forEach(room => {
      console.log(`  - ${room.name} (ID: ${room.id})`);
    });
    
    // 全教室一覧
    console.log('\n📋 全教室一覧:');
    rooms.forEach(room => {
      console.log(`  - ${room.name} (ID: ${room.id})`);
    });
    
  } catch (error) {
    console.error('❌ 教室データ確認エラー:', error);
  }
}

// 実行
checkRooms()
  .then(() => {
    console.log('\n🏁 確認完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
