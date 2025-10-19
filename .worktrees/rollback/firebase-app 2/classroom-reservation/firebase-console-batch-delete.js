// Firebaseコンソールで実行するためのスクリプト
// Firebase Console > Firestore Database > データタブ > スクリプトエディタで実行してください

// 大演習室5のテンプレートロックを一括削除
async function batchDeleteLargeRoom5Locks() {
  console.log('🗑️ 大演習室5のテンプレートロックを一括削除開始...');
  
  try {
    // 大演習室5のテンプレートロックを取得
    const slotsRef = db.collection('reservation_slots');
    const q = slotsRef.where('roomId', '==', 'HNTUWg9hoWo1Ppur9qh6').where('type', '==', 'template-lock');
    
    const querySnapshot = await q.get();
    console.log(`📋 大演習室5のテンプレートロック件数: ${querySnapshot.size}件`);
    
    if (querySnapshot.empty) {
      console.log('✅ 大演習室5のテンプレートロックは見つかりませんでした');
      return;
    }
    
    // バッチ削除
    const batch = db.batch();
    let deletedCount = 0;
    
    querySnapshot.forEach(doc => {
      const slot = doc.data();
      console.log(`🗑️ 削除対象: ${slot.date} ${slot.period}限 (テンプレートID: ${slot.templateId})`);
      
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    // バッチをコミット
    await batch.commit();
    console.log(`🎉 大演習室5のテンプレートロック一括削除完了: ${deletedCount}件`);
    
  } catch (error) {
    console.error('❌ 一括削除処理エラー:', error);
  }
}

// 実行
batchDeleteLargeRoom5Locks();
