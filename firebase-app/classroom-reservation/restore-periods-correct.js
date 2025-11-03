// 正しい時限データ復旧スクリプト
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

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

// 正しい時限データ（GitHubから復元）
const periods = [
  { name: '0限', startTime: '07:30', endTime: '08:30' },
  { name: '1限', startTime: '08:50', endTime: '09:40' },
  { name: '2限', startTime: '09:50', endTime: '10:40' },
  { name: '3限', startTime: '10:50', endTime: '11:40' },
  { name: '4限', startTime: '11:50', endTime: '12:40' },
  { name: 'お昼休み', startTime: '12:40', endTime: '13:25' },
  { name: '5限', startTime: '13:25', endTime: '14:15' },
  { name: '6限', startTime: '14:25', endTime: '15:15' },
  { name: '7限', startTime: '15:25', endTime: '16:15' },
  { name: '放課後', startTime: '16:25', endTime: '18:00' }
];

// 時限データ復旧実行
async function restorePeriods() {
  try {
    console.log('⏰ 正しい時限データ復旧開始...');
    
    const periodsCollection = collection(db, 'periods');
    
    for (const period of periods) {
      const docRef = await addDoc(periodsCollection, {
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        createdAt: new Date()
      });
      console.log('✅ 時限追加成功:', period.name, `(${period.startTime}-${period.endTime})`, 'ID:', docRef.id);
    }
    
    console.log('🎉 正しい時限データ復旧完了! 合計:', periods.length, '時限');
    console.log('📋 復旧した時限:');
    periods.forEach(p => console.log(`  ${p.name}: ${p.startTime} - ${p.endTime}`));
    process.exit(0);
  } catch (error) {
    console.error('❌ 時限復旧エラー:', error);
    process.exit(1);
  }
}

restorePeriods();
