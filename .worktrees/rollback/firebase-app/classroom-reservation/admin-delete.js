const admin = require('firebase-admin');

// Firebase Admin SDK初期化
const serviceAccount = {
  "type": "service_account",
  "project_id": "owa-cbs",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@owa-cbs.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40owa-cbs.iam.gserviceaccount.com"
};

// 注意: 実際のサービスアカウントキーが必要です
// Firebase Console > プロジェクト設定 > サービスアカウント > 新しい秘密鍵の生成

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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
deleteAugust27Locks()
  .then(() => {
    console.log('🏁 処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
