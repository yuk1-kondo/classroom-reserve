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

async function checkTemplates() {
  console.log('📋 固定予約テンプレートの確認開始...');
  
  try {
    // テンプレートコレクションを取得
    const templatesRef = collection(db, 'weekly_templates');
    const snapshot = await getDocs(templatesRef);
    
    console.log(`📊 テンプレート件数: ${snapshot.size}件`);
    
    if (snapshot.empty) {
      console.log('❌ テンプレートデータが存在しません');
      return;
    }
    
    // テンプレートデータを表示
    snapshot.forEach((doc, index) => {
      const template = doc.data();
      console.log(`\n📋 テンプレート ${index + 1}:`);
      console.log('  ID:', doc.id);
      console.log('  名前:', template.name);
      console.log('  教室ID:', template.roomId);
      console.log('  時限:', template.periods);
      console.log('  作成者:', template.createdBy);
      console.log('  作成日:', template.createdAt?.toDate?.() || template.createdAt);
      
      // 大演習室5に関連するテンプレートを特定
      if (template.roomId === 'HNTUWg9hoWo1Ppur9qh6') {
        console.log('  ⚠️  このテンプレートは大演習室5を使用しています！');
      }
    });
    
    // 大演習室5のテンプレートを特定
    console.log('\n🎯 大演習室5関連のテンプレート:');
    const largeRoom5Templates = [];
    snapshot.forEach(doc => {
      const template = doc.data();
      if (template.roomId === 'HNTUWg9hoWo1Ppur9qh6') {
        largeRoom5Templates.push({
          id: doc.id,
          name: template.name,
          periods: template.periods,
          createdBy: template.createdBy
        });
      }
    });
    
    if (largeRoom5Templates.length > 0) {
      largeRoom5Templates.forEach(template => {
        console.log(`  - ${template.name} (時限: ${template.periods})`);
      });
    } else {
      console.log('  - 大演習室5のテンプレートは見つかりませんでした');
    }
    
  } catch (error) {
    console.error('❌ テンプレート確認エラー:', error);
  }
}

// 実行
checkTemplates()
  .then(() => {
    console.log('\n🏁 確認完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 致命的エラー:', error);
    process.exit(1);
  });
