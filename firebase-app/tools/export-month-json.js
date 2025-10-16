#!/usr/bin/env node
/*
  Export current month's reservations to JSON for Cloud Storage upload.
  Usage:
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node tools/export-month-json.js 2025-10
  Output:
    ./dist-bundles/reservations_YYYY-MM.json
*/
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Admin SDK (Application Default Credentials)
if (!admin.apps.length) {
  admin.initializeApp({});
}

const db = admin.firestore();

function parseMonthArg(arg) {
  if (arg && /^\d{4}-\d{2}$/.test(arg)) return arg;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const monthId = parseMonthArg(process.argv[2]);
  const [y, m] = monthId.split('-').map((s) => Number(s));
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  const coll = db.collection('reservations');
  const snap = await coll
    .where('startTime', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('startTime', '<=', admin.firestore.Timestamp.fromDate(end))
    .orderBy('startTime', 'asc')
    .get();

  const docs = snap.docs.map((d) => {
    const data = d.data();
    // Serialize Firestore Timestamps to ISO strings for portability
    const toIso = (ts) => {
      try { return ts?.toDate?.().toISOString() || null; } catch { return null; }
    };
    return {
      id: d.id,
      ...data,
      startTime: toIso(data.startTime) || data.startTime,
      endTime: toIso(data.endTime) || data.endTime,
      createdAt: toIso(data.createdAt) || data.createdAt
    };
  });

  const outDir = path.resolve(__dirname, '../dist-bundles');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `reservations_${monthId}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ monthId, docs }), 'utf-8');
  console.log(`✅ Exported ${docs.length} docs -> ${outPath}`);
  console.log('Upload to Cloud Storage path: bundles/reservations_%s.json', monthId);
}

main().catch((e) => {
  console.error('❌ Export failed:', e);
  process.exit(1);
});


