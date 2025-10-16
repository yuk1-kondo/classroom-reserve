// reservation_slots の孤立・不正ドキュメントを検出/削除するメンテナンススクリプト
// 使い方:
//   node cleanup-orphan-slots.js [--fix] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--room ROOM_ID]
// 例:
//   ドライラン(一覧のみ): node cleanup-orphan-slots.js
//   実際に削除:           node cleanup-orphan-slots.js --fix
//   期間指定で削除:       node cleanup-orphan-slots.js --fix --start 2025-04-01 --end 2025-09-30
//   教室指定で削除:       node cleanup-orphan-slots.js --fix --room room-11

/* eslint-disable no-console */
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, collection, doc, getDoc, getDocs, query, where, deleteDoc 
} = require('firebase/firestore');

// Firebase 設定（アプリ内 src/firebase/config.ts と同一のプロジェクト）
const firebaseConfig = {
  apiKey: 'AIzaSyCfoxuAOMMfYBA3RfUU99FsZVbYrpyUkh4',
  authDomain: 'owa-cbs.firebaseapp.com',
  projectId: 'owa-cbs',
  storageBucket: 'owa-cbs.firebasestorage.app',
  messagingSenderId: '943019235591',
  appId: '1:943019235591:web:e4fe959a4c135524cc0da2'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function parseArgs(argv) {
  const args = { fix: false, start: null, end: null, room: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fix') args.fix = true;
    else if (a === '--start') args.start = argv[++i] || null;
    else if (a === '--end') args.end = argv[++i] || null;
    else if (a === '--room') args.room = argv[++i] || null;
  }
  return args;
}

function isValidDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

async function main() {
  const { fix, start, end, room } = parseArgs(process.argv);
  console.log(`🔍 reservation_slots クリーンアップ\n  - fix: ${fix}\n  - start: ${start || '(なし)'}\n  - end: ${end || '(なし)'}\n  - room: ${room || '(なし)'}`);

  const conditions = [];
  if (isValidDateStr(start)) conditions.push(where('date', '>=', start));
  if (isValidDateStr(end)) conditions.push(where('date', '<=', end));
  if (room) conditions.push(where('roomId', '==', room));

  const colRef = collection(db, 'reservation_slots');
  const snap = conditions.length > 0 ? await getDocs(query(colRef, ...conditions)) : await getDocs(colRef);

  console.log('📦 検査対象スロット:', snap.size, '件');

  let orphanCount = 0;
  let invalidCount = 0;
  let lockCount = 0;
  let okCount = 0;
  const toDelete = [];

  for (const d of snap.docs) {
    const data = d.data();
    const id = d.id;
    const { roomId, date, period, type, reservationId } = data;

    // テンプレートロックはそのまま（通常予約作成時に上書き対象）
    if (type === 'template-lock') {
      lockCount++;
      continue;
    }

    // reservationId が未設定か null で、かつ template-lock でもない → 不正スロット
    if (!reservationId) {
      invalidCount++;
      toDelete.push({ ref: d.ref, id, reason: 'no-reservationId-and-not-lock', info: { roomId, date, period, type } });
      continue;
    }

    // 参照先予約の存在確認
    try {
      const resSnap = await getDoc(doc(db, 'reservations', String(reservationId)));
      if (!resSnap.exists()) {
        orphanCount++;
        toDelete.push({ ref: d.ref, id, reason: 'reservation-missing', info: { roomId, date, period, type, reservationId } });
      } else {
        okCount++;
      }
    } catch (e) {
      console.warn('⚠️ 予約参照取得エラー:', reservationId, e);
    }
  }

  console.log('\n📊 サマリ');
  console.log('  テンプレートロック (保持):', lockCount);
  console.log('  正常スロット (予約あり):  ', okCount);
  console.log('  孤立スロット (予約欠落):  ', orphanCount);
  console.log('  不正スロット (ID欠落等): ', invalidCount);

  if (toDelete.length === 0) {
    console.log('\n✅ 削除対象はありません');
    return;
  }

  console.log('\n🧹 削除対象一覧 (最大50件表示)');
  toDelete.slice(0, 50).forEach((item, i) => {
    console.log(`${i + 1}. ${item.id} [${item.reason}]`, item.info);
  });
  if (toDelete.length > 50) console.log(`  ... ほか ${toDelete.length - 50} 件`);

  if (!fix) {
    console.log('\nℹ️ ドライランです。実削除するには --fix を付けて再実行してください。');
    return;
  }

  console.log('\n🚧 削除を実行します... 件数:', toDelete.length);
  let deleted = 0;
  for (const item of toDelete) {
    try {
      await deleteDoc(item.ref);
      deleted++;
    } catch (e) {
      console.error('❌ 削除失敗:', item.id, e);
    }
  }
  console.log(`\n🎉 削除完了: ${deleted}/${toDelete.length} 件`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('💥 致命的エラー:', err);
  process.exit(1);
});


