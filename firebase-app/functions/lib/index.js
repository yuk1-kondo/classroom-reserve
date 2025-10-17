"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyMonthlyBundleAt5JST = exports.ensureLatestMonthlyBundle = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const admin = require("firebase-admin");
admin.initializeApp();
(0, v2_1.setGlobalOptions)({ region: 'asia-northeast1', memory: '256MiB', timeoutSeconds: 60 });
const db = admin.firestore();
const storage = admin.storage();
// 共有: 月次JSONバンドル生成ロジック
async function generateMonthlyBundle(targetDate) {
    const now = targetDate ? new Date(targetDate) : new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const monthId = `${y}-${m}`;
    // メタドキュメントで多重生成を抑止（同日内は1回のみ）
    const metaRef = db.collection('bundle_meta').doc(monthId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(metaRef);
        const data = snap.exists ? snap.data() : {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
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
    // JSONバンドルとしてCloud Storageへ保存
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bucket = storage.bucket();
    const file = bucket.file(`bundles/reservations_${monthId}.json`);
    await file.save(JSON.stringify({ monthId, docs }), {
        contentType: 'application/json',
        resumable: false,
        metadata: { cacheControl: 'public, max-age=86400, immutable' }
    });
    return { monthId, count: docs.length, file: file.name };
}
// HTTPS Function: 手動トリガで当月の予約をJSON化して保存
exports.ensureLatestMonthlyBundle = (0, https_1.onRequest)(async (req, res) => {
    try {
        const result = await generateMonthlyBundle();
        res.status(200).json({ ok: true, ...result });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
});
// Scheduler Function: 毎日 05:00 JST に自動生成
exports.dailyMonthlyBundleAt5JST = (0, scheduler_1.onSchedule)({ schedule: 'every day 05:00', timeZone: 'Asia/Tokyo' }, async (event) => {
    try {
        await generateMonthlyBundle();
        // ログのみ（HTTPSレスポンス不要）
        console.log('✅ monthly bundle generated at 05:00 JST');
    }
    catch (e) {
        console.error('❌ monthly bundle generation failed:', e);
        throw e;
    }
});
//# sourceMappingURL=index.js.map