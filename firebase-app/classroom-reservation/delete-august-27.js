const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, deleteDoc, doc, Timestamp } = require('firebase/firestore');

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

async function deleteAugust27Reservations() {
  console.log('🗓️ 8月27日の予約を削除開始...');
  
  try {
    // 8月27日の予約を取得
    const targetDate = new Date('2025-08-27');
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('🔍 予約検索範囲:', startOfDay.toISOString(), '〜', endOfDay.toISOString());
    
    // 予約コレクションから該当日の予約を取得
    const reservationsRef = collection(db, 'reservations');
    const q = query(
      reservationsRef,
      where('startTime', '>=', Timestamp.fromDate(startOfDay)),
      where('startTime', '<=', Timestamp.fromDate(endOfDay))
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`📋 8月27日の予約件数: ${querySnapshot.size}件`);
    
    if (querySnapshot.empty) {
      console.log('✅ 8月27日の予約は見つかりませんでした');
      return;
    }
    
    // 予約を削除
    let deletedCount = 0;
    for (const docSnap of querySnapshot.docs) {
      const reservation = docSnap.data();
      console.log(`🗑️ 削除中: ${reservation.title} (${reservation.roomName}, ${reservation.period})`);
      
      try {
        await deleteDoc(doc(db, 'reservations', docSnap.id));
        deletedCount++;
        console.log(`✅ 削除完了: ${docSnap.id}`);
      } catch (error) {
        console.error(`❌ 削除失敗: ${docSnap.id}`, error);
      }
    }
    
    console.log(`🎉 8月27日の予約削除完了: ${deletedCount}件`);
    
    // 関連するスロットも削除
    console.log('🔍 関連スロットの削除開始...');
    const slotsRef = collection(db, 'reservation_slots');
    const slotQuery = query(slotsRef, where('date', '==', '2025-08-27'));
    const slotSnapshot = await getDocs(slotQuery);
    
    console.log(`📋 8月27日のスロット件数: ${slotSnapshot.size}件`);
    
    let deletedSlots = 0;
    for (const slotDoc of slotSnapshot.docs) {
      const slot = slotDoc.data();
      console.log(`🗑️ スロット削除中: ${slot.roomId} ${slot.period}`);
      
      try {
        await deleteDoc(doc(db, 'reservation_slots', slotDoc.id));
        deletedSlots++;
        console.log(`✅ スロット削除完了: ${slotDoc.id}`);
      } catch (error) {
        console.error(`❌ スロット削除失敗: ${slotDoc.id}`, error);
      }
    }
    
    console.log(`🎉 スロット削除完了: ${deletedSlots}件`);
    console.log(`📊 総削除件数: 予約${deletedCount}件 + スロット${deletedSlots}件`);
    
  } catch (error) {
    console.error('❌ 削除処理エラー:', error);
  }
}

// 実行
deleteAugust27Reservations()
  .then(() => {
    console.log('🏁 処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
