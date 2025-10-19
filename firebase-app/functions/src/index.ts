import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
setGlobalOptions({ region: 'asia-northeast1', memory: '256MiB', timeoutSeconds: 60 });
const db = admin.firestore();
const storage = admin.storage();

// 共有: 月次JSONバンドル生成ロジック
async function generateMonthlyBundle(targetDate?: Date): Promise<{ monthId: string; count: number; file: string; generatedAt: string }> {
  const now = targetDate ? new Date(targetDate) : new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const monthId = `${y}-${m}`;

  // メタドキュメントで多重生成を抑止（同日内は1回のみ）
  const metaRef = db.collection('bundle_meta').doc(monthId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(metaRef);
    const data = snap.exists ? (snap.data() as any) : {};
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

  // JSONバンドルとしてCloud Storageへ保存（生成時刻を含める）
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const generatedAt = admin.firestore.Timestamp.now();
  const bucket = storage.bucket();
  const file = bucket.file(`bundles/reservations_${monthId}.json`);
  await file.save(JSON.stringify({ monthId, docs, generatedAt: generatedAt.toMillis() }), {
    contentType: 'application/json',
    resumable: false,
    metadata: { cacheControl: 'public, max-age=86400, immutable' }
  });

  return { monthId, count: docs.length, file: file.name, generatedAt: generatedAt.toDate().toISOString() };
}

// HTTPS Function: 手動トリガで当月の予約をJSON化して保存
export const ensureLatestMonthlyBundle = onRequest(async (req, res) => {
  try {
    // オプション: ?month=YYYY-MM で対象月を指定
    let result;
    const m = (req.query?.month as string) || '';
    if (/^\d{4}-\d{2}$/.test(m)) {
      const [y, mm] = m.split('-').map((s) => parseInt(s, 10));
      const d = new Date(y, mm - 1, 1);
      result = await generateMonthlyBundle(d);
    } else {
      result = await generateMonthlyBundle();
    }
    res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Scheduler Function: 毎日 05:00 JST に自動生成
export const dailyMonthlyBundleAt5JST = onSchedule({ schedule: 'every day 05:00', timeZone: 'Asia/Tokyo' }, async (event) => {
  try {
    await generateMonthlyBundle();
    // ログのみ（HTTPSレスポンス不要）
    console.log('✅ monthly bundle generated at 05:00 JST');
  } catch (e) {
    console.error('❌ monthly bundle generation failed:', e);
    throw e;
  }
});

// 追加: 指定基準月から 過去1ヶ月〜先2ヶ月 をまとめて生成
export const buildBundleWindow = onRequest(async (req, res) => {
  try {
    // ?base=YYYY-MM（省略時は当月）
    const base = (req.query?.base as string) || '';
    let baseDate: Date;
    if (/^\d{4}-\d{2}$/.test(base)) {
      const [y, mm] = base.split('-').map((s) => parseInt(s, 10));
      baseDate = new Date(y, mm - 1, 1);
    } else {
      const now = new Date();
      baseDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const months: Date[] = [
      new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1), // -1
      new Date(baseDate.getFullYear(), baseDate.getMonth() + 0, 1), // 0
      new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1), // +1
      new Date(baseDate.getFullYear(), baseDate.getMonth() + 2, 1), // +2
    ];
    const results = [] as any[];
    for (const d of months) {
      const r = await generateMonthlyBundle(d);
      results.push(r);
    }
    res.status(200).json({ ok: true, results });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});


