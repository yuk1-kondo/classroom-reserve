import { collection, doc, getDocs, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { WeeklyTemplate } from './recurringTemplates';

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

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
        const slotId = `${tpl.roomId}_${dateStr}_${p}`;
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
