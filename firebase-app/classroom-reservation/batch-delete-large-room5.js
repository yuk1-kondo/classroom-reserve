const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, writeBatch, doc } = require('firebase/firestore');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBxJjOWL6Ej3NqVfBcT1LMTHOM8ZHQqGPY",
  authDomain: "owa-cbs.firebaseapp.com",
  projectId: "owa-cbs",
  storageBucket: "owa-cbs.appspot.com",
  messagingSenderId: "1098765432109",
  appId: "1:1098765432109:web:abcdef1234567890"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function batchDeleteLargeRoom5Locks() {
  console.log('🗑️ 大演習室5のテンプレートロックを一括削除開始...');
  
  try {
    // 大演習室5のテンプレートロックを取得
    const slotsRef = collection(db, 'reservation_slots');
    const q = query(
      slotsRef,
      where('roomId', '==', 'HNTUWg9hoWo1Ppur9qh6'),
      where('type', '==', 'template-lock')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`📋 大演習室5のテンプレートロック件数: ${querySnapshot.size}件`);
    
    if (querySnapshot.empty) {
      console.log('✅ 大演習室5のテンプレートロックは見つかりませんでした');
      return;
    }
    
    // バッチ削除（500件ずつ）
    let batch = writeBatch(db);
    let deletedCount = 0;
    let batchCount = 0;
    
    for (const docSnap of querySnapshot.docs) {
      const slot = docSnap.data();
      console.log(`🗑️ 削除対象: ${slot.date} ${slot.period}限 (テンプレートID: ${slot.templateId})`);
      
      batch.delete(doc(db, 'reservation_slots', docSnap.id));
      deletedCount++;
      
      // 500件ごとにバッチをコミット
      if (deletedCount % 500 === 0) {
        await batch.commit();
        console.log(`✅ バッチ${++batchCount}コミット完了: ${deletedCount}件`);
        batch = writeBatch(db);
      }
    }
    
    // 残りのバッチをコミット
    if (deletedCount % 500 !== 0) {
      await batch.commit();
      console.log(`✅ 最終バッチコミット完了: ${deletedCount}件`);
    }
    
    console.log(`🎉 大演習室5のテンプレートロック一括削除完了: 合計${deletedCount}件`);
    
  } catch (error) {
    console.error('❌ 一括削除処理エラー:', error);
  }
}

// 実行
batchDeleteLargeRoom5Locks()
  .then(() => {
    console.log('🏁 処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
