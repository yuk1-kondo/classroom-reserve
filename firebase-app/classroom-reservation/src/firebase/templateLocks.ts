import { collection, doc, getDocs, runTransaction, Timestamp, query, where, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { WeeklyTemplate } from './recurringTemplates';
import { makeSlotId } from '../utils/slot';
import { toDateStr } from '../utils/dateRange';

const RESERVATION_SLOTS_COLLECTION = 'reservation_slots';
const TEMPLATES_COLLECTION = 'recurring_templates';

function iterateDates(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d <= end) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

// toDateStr は utils/dateRange の共通実装を使用

export async function listEnabledTemplates(): Promise<WeeklyTemplate[]> {
  const snap = await getDocs(collection(db, TEMPLATES_COLLECTION));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as WeeklyTemplate) }))
    .filter(t => t.enabled);
}

export async function applyTemplateLocks(rangeStart: string, rangeEnd: string, currentUserId?: string): Promise<{created: number; skipped: number;}> {
  const start = toDate(rangeStart);
  const end = toDate(rangeEnd);
  const templates = await listEnabledTemplates();
  let created = 0;
  let skipped = 0;

  for (const tpl of templates) {
    const tplStart = toDate(tpl.startDate);
    const tplEnd = tpl.endDate ? toDate(tpl.endDate) : undefined;

  for (const d of iterateDates(start, end)) {
      // テンプレートの期間内かつ曜日一致
      if (d.getDay() !== tpl.weekday) continue;
      if (d < tplStart) continue;
      if (tplEnd && d > tplEnd) continue;

      const dateStr = toDateStr(d);
      for (const p of tpl.periods) {
        const slotId = makeSlotId(tpl.roomId, dateStr, p);
        const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
        const result = await runTransaction(db, async (tx) => {
          const snap = await tx.get(slotRef);
          if (snap.exists()) {
            return 'skipped' as const;
          }
          tx.set(slotRef, {
            roomId: tpl.roomId,
            date: dateStr,
            period: String(p),
            reservationId: null, // ロックのみ
            type: 'template-lock',
            templateId: tpl.id || null,
            createdBy: currentUserId || 'template',
            createdAt: Timestamp.now(),
          });
          return 'created' as const;
        });
        if (result === 'created') created++; else skipped++;
      }
    }
  }
  return { created, skipped };
}

// 指定範囲のテンプレロックを削除
export async function removeTemplateLocks(
  rangeStart: string,
  rangeEnd: string,
  opts?: { roomId?: string; templateId?: string }
): Promise<{ deleted: number }> {
  const conditions = [
    where('date', '>=', rangeStart),
    where('date', '<=', rangeEnd),
    where('type', '==', 'template-lock')
  ];
  if (opts?.roomId) conditions.push(where('roomId', '==', opts.roomId));
  if (opts?.templateId) conditions.push(where('templateId', '==', opts.templateId));

  const q = query(collection(db, RESERVATION_SLOTS_COLLECTION), ...conditions as any);
  const snap = await getDocs(q);
  if (snap.empty) return { deleted: 0 };

  let deleted = 0;
  let batch = writeBatch(db);
  let ops = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops++; deleted++;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db); ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return { deleted };
}
