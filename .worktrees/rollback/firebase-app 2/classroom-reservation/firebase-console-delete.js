// Firebaseコンソールで実行するためのスクリプト
// Firebase Console > Firestore Database > データタブ > スクリプトエディタで実行してください

// 8月27日のテンプレートロックを削除
async function deleteAugust27Locks() {
  console.log('🗓️ 8月27日のテンプレートロックを削除開始...');
  
  try {
    // 8月27日のテンプレートロックを取得
    const slotsRef = db.collection('reservation_slots');
    const q = slotsRef.where('date', '==', '2025-08-27').where('type', '==', 'template-lock');
    
    const querySnapshot = await q.get();
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
        await docSnap.ref.delete();
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
deleteAugust27Locks();
