import { reservationsService, createDateTimeFromPeriod } from './firestore';
import { listEnabledTemplates } from './templateLocks';

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

function iterateDates(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d <= end) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export async function applyTemplateReservations(rangeStart: string, rangeEnd: string, currentUserId?: string): Promise<{created: number; skipped: number; errors: number;}> {
  const start = toDate(rangeStart);
  const end = toDate(rangeEnd);
  const templates = await listEnabledTemplates();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const tpl of templates) {
    const tplStart = toDate(tpl.startDate);
    const tplEnd = tpl.endDate ? toDate(tpl.endDate) : undefined;
    for (const d of iterateDates(start, end)) {
      if (d.getDay() !== tpl.weekday) continue;
      if (d < tplStart) continue;
      if (tplEnd && d > tplEnd) continue;
      const dateStr = toDateStr(d);
      for (const p of tpl.periods) {
        try {
          const dt = createDateTimeFromPeriod(dateStr, String(p));
          if (!dt) { skipped++; continue; }
          await reservationsService.addReservation({
            roomId: tpl.roomId,
            roomName: tpl.roomId, // 表示は後で正規化されるためIDでも可
            title: tpl.name || '固定予約',
            reservationName: '固定予約',
            startTime: (await import('firebase/firestore')).Timestamp.fromDate(dt.start),
            endTime: (await import('firebase/firestore')).Timestamp.fromDate(dt.end),
            period: String(p),
            periodName: dt.periodName,
            createdBy: currentUserId || 'template'
          });
          created++;
        } catch (e: any) {
          // 競合などはスキップ扱いにし、その他は errors として計上
          const msg = String(e?.message || '');
          if (/既に存在します|exists/i.test(msg)) skipped++; else errors++;
        }
      }
    }
  }
  return { created, skipped, errors };
}
