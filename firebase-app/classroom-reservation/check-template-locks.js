const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function checkTemplateLocks() {
  console.log('🔍 テンプレートロックの確認開始...');
  
  try {
    // 全コレクションを確認
    const collections = ['template-locks', 'reservation_slots', 'reservations', 'weekly_templates'];
    
    for (const collectionName of collections) {
      console.log(`\n📋 ${collectionName} コレクションを確認中...`);
      
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        console.log(`📊 ${collectionName}: ${snapshot.size}件`);
        
        // 8月27日に関連するデータを探す
        const august27Data = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const dateStr = data.date || data.startTime?.toDate?.()?.toISOString()?.slice(0, 10) || '';
          
          if (dateStr.includes('2025-08-27') || 
              (data.roomId && data.period) || 
              data.type === 'template-lock') {
            august27Data.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        if (august27Data.length > 0) {
          console.log(`🎯 ${collectionName} で8月27日関連データ発見: ${august27Data.length}件`);
          august27Data.forEach(item => {
            console.log(`  - ID: ${item.id}`);
            console.log(`    データ:`, JSON.stringify(item, null, 2));
          });
        }
        
      } catch (error) {
        console.log(`❌ ${collectionName} アクセスエラー:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ 確認処理エラー:', error);
  }
}

// 実行
checkTemplateLocks()
  .then(() => {
    console.log('\n🏁 確認完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
