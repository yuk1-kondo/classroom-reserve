const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function deleteAugust27Locks() {
  console.log('🗓️ 8月27日のテンプレートロックを削除開始...');
  
  try {
    // 8月27日のテンプレートロックを取得
    const slotsRef = collection(db, 'reservation_slots');
    const q = query(
      slotsRef,
      where('date', '==', '2025-08-27'),
      where('type', '==', 'template-lock')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`📋 8月27日のテンプレートロック件数: ${querySnapshot.size}件`);
    
    if (querySnapshot.empty) {
      console.log('✅ 8月27日のテンプレートロックは見つかりませんでした');
      return;
    }
    
    // テンプレートロックを削除
    let deletedCount = 0;
    for (const docSnap of querySnapshot.docs) {
      const slot = docSnap.data();
      console.log(`🗑️ 削除中: ${slot.roomId} ${slot.period}限 (${slot.date})`);
      
      try {
        await deleteDoc(doc(db, 'reservation_slots', docSnap.id));
        deletedCount++;
        console.log(`✅ 削除完了: ${docSnap.id}`);
      } catch (error) {
        console.error(`❌ 削除失敗: ${docSnap.id}`, error);
      }
    }
    
    console.log(`🎉 8月27日のテンプレートロック削除完了: ${deletedCount}件`);
    
  } catch (error) {
    console.error('❌ 削除処理エラー:', error);
  }
}

// 実行
deleteAugust27Locks()
  .then(() => {
    console.log('🏁 処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
