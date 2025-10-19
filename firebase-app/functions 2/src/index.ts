import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
setGlobalOptions({ region: 'asia-northeast1', memory: '256MiB', timeoutSeconds: 60 });
const db = admin.firestore();
const storage = admin.storage();

// HTTPS Function: 当月の予約を Data Bundle 化して Cloud Storage に保存
export const ensureLatestMonthlyBundle = onRequest(async (req, res) => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const monthId = `${y}-${m}`;

    // メタドキュメントで多重生成を抑止
    const metaRef = db.collection('bundle_meta').doc(monthId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(metaRef);
      const data = snap.exists ? snap.data() as any : {};
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const last = data?.lastBuiltAt ? (data.lastBuiltAt.toDate ? data.lastBuiltAt.toDate() : new Date(data.lastBuiltAt)) : null;
      if (last && last.getTime() >= today.getTime()) {
        return; // 今日は生成済み
      }
      tx.set(metaRef, { lastBuiltAt: admin.firestore.Timestamp.now() }, { merge: true });
    });

    // 当月レンジで予約を取得
    const start = new Date(y, now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(y, now.getMonth() + 1, 0, 23, 59, 59, 999);
    const reservationsRef = db.collection('reservations');
    const snap = await reservationsRef
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(end))
      .orderBy('startTime', 'asc')
      .get();

    // 簡易バンドル: Firestore Data Bundle API は Admin SDK 未対応のため、
    // ここでは JSON を書き出し、クライアント側で loadBundle 失敗時のフォールバックに使う。
    // 将来 Admin SDK に対応したら置き換え。
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const bucket = storage.bucket();
    const file = bucket.file(`bundles/reservations_${monthId}.json`);
    await file.save(JSON.stringify({ monthId, docs }), {
      contentType: 'application/json',
      resumable: false,
      metadata: { cacheControl: 'public, max-age=3600, immutable' }
    });

    res.status(200).json({ ok: true, monthId, count: docs.length, file: file.name });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});


