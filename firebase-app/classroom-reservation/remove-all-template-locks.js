/* eslint-disable no-console */
// reservation_slots から type == 'template-lock' のドキュメントを一括削除します。
// 使い方:
//   node remove-all-template-locks.js [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--room ROOM_ID]
// 例:
//   すべて削除:                  node remove-all-template-locks.js
//   期間指定のみ削除:            node remove-all-template-locks.js --start 2025-01-01 --end 2025-12-31
//   教室指定のみ削除:            node remove-all-template-locks.js --room room-11

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} = require('firebase/firestore');

// プロジェクト設定はアプリ内 src/firebase/config.ts と同一
const firebaseConfig = {
  apiKey: 'AIzaSyCfoxuAOMMfYBA3RfUU99FsZVbYrpyUkh4',
  authDomain: 'owa-cbs.firebaseapp.com',
  projectId: 'owa-cbs',
  storageBucket: 'owa-cbs.firebasestorage.app',
  messagingSenderId: '943019235591',
  appId: '1:943019235591:web:e4fe959a4c135524cc0da2',
};

function parseArgs(argv) {
  const args = { start: null, end: null, room: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--start') args.start = argv[++i] || null;
    else if (a === '--end') args.end = argv[++i] || null;
    else if (a === '--room') args.room = argv[++i] || null;
  }
  return args;
}

function isValidDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

async function main() {
  const { start, end, room } = parseArgs(process.argv);
  console.log('🗑️ テンプレートロック一括削除開始');
  console.log('  条件:', { start, end, room });

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const conditions = [where('type', '==', 'template-lock')];
  if (isValidDateStr(start)) conditions.push(where('date', '>=', start));
  if (isValidDateStr(end)) conditions.push(where('date', '<=', end));
  if (room) conditions.push(where('roomId', '==', room));

  const colRef = collection(db, 'reservation_slots');
  const snap = await getDocs(conditions.length > 0 ? query(colRef, ...conditions) : colRef);
  console.log('  対象件数:', snap.size);
  if (snap.empty) {
    console.log('✅ 削除対象はありません');
    return;
  }

  let ops = 0;
  let deleted = 0;
  let batch = writeBatch(db);
  for (const d of snap.docs) {
    batch.delete(doc(db, 'reservation_slots', d.id));
    ops++; deleted++;
    if (ops >= 450) {
      await batch.commit();
      console.log(`  ... バッチコミット (累計削除 ${deleted}/${snap.size})`);
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) {
    await batch.commit();
  }
  console.log(`🎉 削除完了: ${deleted}/${snap.size} 件`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('💥 エラー:', err);
  process.exit(1);
});


