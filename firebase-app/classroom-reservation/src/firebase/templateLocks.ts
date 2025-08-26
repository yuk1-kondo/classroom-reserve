import { collection, doc, getDocs, runTransaction, Timestamp, query, where, writeBatch, Transaction } from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS, SLOT_TYPES } from '../constants/collections';
import { WeeklyTemplate, TemplatePriority } from '../types/templates';
import { makeSlotId } from '../utils/slot';
import { toDateStr } from '../utils/dateRange';
import { reservationsService, roomsService } from './firestore';
import { periodTimeMap as PERIOD_TIME_MAP, createDateTimeFromPeriod as createDTFromPeriod } from '../utils/periods';
import { ConflictResolutionService } from '../services/conflictResolutionService';


const RESERVATION_SLOTS_COLLECTION = COLLECTIONS.RESERVATION_SLOTS;

const TEMPLATES_COLLECTION = COLLECTIONS.RECURRING_TEMPLATES;

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

// 既存の関数を保持（後方互換性）
export async function applyTemplateLocks(
  rangeStart: string, 
  rangeEnd: string, 
  currentUserId?: string
): Promise<{created: number; skipped: number;}> {
  return applyTemplateLocksWithPriority(rangeStart, rangeEnd, currentUserId);
}

// 新規追加: 優先度付きテンプレートロック適用
export async function applyTemplateLocksWithPriority(
  rangeStart: string,
  rangeEnd: string,
  currentUserId?: string,
  options: {
    forceOverride?: boolean;
    priority?: TemplatePriority;
    dryRun?: boolean;
  } = {}
): Promise<{
  created: number;
  skipped: number;
  conflicts: any[];
  overridden: number;
  relocated: number;
}> {
  const start = toDate(rangeStart);
  const end = toDate(rangeEnd);
  const templates = await listEnabledTemplates();
  
  let created = 0;
  let skipped = 0;
  let conflicts: any[] = [];
  let overridden = 0;
  let relocated = 0;

  // 優先度順にソート（critical → high → normal）
  const priorityOrder: TemplatePriority[] = ['critical', 'high', 'normal'];
  const sortedTemplates = templates.sort((a, b) => {
    const priorityA = a.priority || 'normal';
    const priorityB = b.priority || 'normal';
    return priorityOrder.indexOf(priorityA) - priorityOrder.indexOf(priorityB);
  });

  for (const tpl of sortedTemplates) {
    // 優先度フィルターが指定されている場合はスキップ
    if (options.priority && tpl.priority !== options.priority) {
      continue;
    }

    const tplStart = toDate(tpl.startDate);
    const tplEnd = tpl.endDate ? toDate(tpl.endDate) : undefined;

    for (const d of iterateDates(start, end)) {
      // テンプレートの期間内かつ曜日一致
      if (d.getDay() !== tpl.weekday) continue;
      if (d < tplStart) continue;
      if (tplEnd && d > tplEnd) continue;

      const dateStr = toDateStr(d);
      
      for (const p of tpl.periods) {
        try {
          const result = await processTemplatePeriod(
            tpl, 
            dateStr, 
            p, 
            currentUserId, 
            options
          );
          
          if (result.success) {
            if (result.action === 'overridden') {
              overridden++;
            } else if (result.action === 'relocated') {
              relocated++;
            }
            created++;
          } else {
            skipped++;
          }
          
          if (result.conflicts.length > 0) {
            conflicts.push(...result.conflicts);
          }
        } catch (error) {
          console.error(`テンプレート処理エラー: ${tpl.name} ${dateStr} ${p}`, error);
          skipped++;
        }
      }
    }
  }
  
  return { created, skipped, conflicts, overridden, relocated };
}

// テンプレートから通常の予約を作成（カレンダーに表示され、手動削除可能）
export async function applyTemplatesAsReservations(
  rangeStart: string,
  rangeEnd: string,
  currentUserId?: string,
  options: { forceOverride?: boolean; dryRun?: boolean } = {}
): Promise<{ created: number; skipped: number; conflicts: any[]; overridden: number; relocated: number }>{
  const start = toDate(rangeStart);
  const end = toDate(rangeEnd);
  const templates = await listEnabledTemplates();
  // 追加: roomId→roomName の補完マップ
  const rooms = await roomsService.getAllRooms().catch(()=>[] as any[]);
  const roomIdToName: Record<string,string> = Object.fromEntries(
    (rooms || []).map((r: any) => [String(r.id || ''), String(r.name || '')])
  );

  let created = 0;
  let skipped = 0;
  let overridden = 0;
  const conflicts: any[] = [];

  for (const tpl of templates) {
    const tplStart = toDate(tpl.startDate);
    const tplEnd = tpl.endDate ? toDate(tpl.endDate) : undefined;

    for (const d of iterateDates(start, end)) {
      // 複数曜日対応: weekdaysがあればそれを使用、なければweekdayを使用
      const targetWeekdays = tpl.weekdays || [tpl.weekday];
      if (!targetWeekdays.includes(d.getDay())) continue;
      if (d < tplStart) continue;
      if (tplEnd && d > tplEnd) continue;

      const dateStr = toDateStr(d);
      const dayReservations = await reservationsService.getDayReservations(new Date(dateStr));

      for (const p of tpl.periods) {
        const periodStr = String(p);
        const exist = dayReservations.find(r => r.roomId === tpl.roomId && r.period === periodStr);
        if (exist) {
          if (!options.forceOverride) {
            skipped++;
            conflicts.push({ date: dateStr, roomId: tpl.roomId, period: periodStr, existingReservation: exist, template: tpl, action: 'skipped' });
            continue;
          }
          // 強制上書き
          try { if (exist.id) await reservationsService.deleteReservation(exist.id); } catch {}
          overridden++;
        }

        if (options.dryRun) { created++; continue; }

        // 予約作成
        const dt = createDTFromPeriod(dateStr, periodStr);
        const startTime = Timestamp.fromDate(dt ? dt.start : new Date(`${dateStr}T00:00:00`));
        const endTime = Timestamp.fromDate(dt ? dt.end : new Date(`${dateStr}T00:00:00`));

        await reservationsService.addReservation({
          title: tpl.name,
          reservationName: '管理者',
          roomId: tpl.roomId,
          roomName: roomIdToName[tpl.roomId] || tpl.roomId, // 空欄防止のため補完
          startTime,
          endTime,
          period: periodStr,
          periodName: dt ? dt.periodName : periodStr,
          createdBy: currentUserId || 'system'
        });
        created++;
      }
    }
  }

  return { created, skipped, conflicts, overridden, relocated: 0 };
}

// 個別のテンプレート期間処理
async function processTemplatePeriod(
  template: WeeklyTemplate,
  dateStr: string,
  period: string | number,
  currentUserId?: string,
  options: { forceOverride?: boolean; dryRun?: boolean } = {}
): Promise<{
  success: boolean;
  action: 'overridden' | 'relocated' | 'skipped' | 'notified';
  conflicts: any[];
}> {
  const slotId = makeSlotId(template.roomId, dateStr, String(period));
  const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
  
  if (options.dryRun) {
    // テスト実行の場合は競合チェックのみ
    const slotSnap = await getDocs(query(
      collection(db, RESERVATION_SLOTS_COLLECTION),
      where('roomId', '==', template.roomId),
      where('date', '==', dateStr),
      where('period', '==', String(period))
    ));
    
    if (slotSnap.empty) {
      return { success: true, action: 'skipped', conflicts: [] };
    } else {
      // 競合を検出
      const conflicts = slotSnap.docs.map(doc => doc.data());
      return { success: false, action: 'skipped', conflicts };
    }
  }

  return await runTransaction(db, async (tx: Transaction) => {
    const slotSnap = await tx.get(slotRef);
    
    if (slotSnap.exists()) {
      // 既存のスロットがある場合
      const existingSlot = slotSnap.data();
      
      if (existingSlot.type === SLOT_TYPES.TEMPLATE_LOCK) {
        // 既存のテンプレートロックの場合はスキップ
        return { success: false, action: 'skipped', conflicts: [] };
      }
      
      if (existingSlot.reservationId) {
        // 既存の予約がある場合
        const existingReservation = await getExistingReservation(existingSlot.reservationId);
        
        if (existingReservation) {
          // 競合解決を実行
          const resolutionResult = await ConflictResolutionService.resolveTemplateConflicts(
            template,
            [existingReservation],
            { forceOverride: options.forceOverride }
          );
          
          if (resolutionResult.success) {
            // 競合解決が成功した場合
            if (resolutionResult.action === 'overridden') {
              // 既存予約を削除してテンプレートロックを作成
              tx.delete(slotRef);
              tx.set(slotRef, {
                roomId: template.roomId,
                date: dateStr,
                period: String(period),
                reservationId: null,
                type: SLOT_TYPES.TEMPLATE_LOCK,
                templateId: template.id || null,
                createdBy: currentUserId || 'template',
                createdAt: Timestamp.now(),
                priority: template.priority || 'normal',
                category: template.category || 'other'
              });
              
              return { 
                success: true, 
                action: 'overridden', 
                conflicts: resolutionResult.conflicts 
              };
            } else if (resolutionResult.action === 'relocated') {
              // 既存予約が移動された場合
              tx.delete(slotRef);
              tx.set(slotRef, {
                roomId: template.roomId,
                date: dateStr,
                period: String(period),
                reservationId: null,
                type: SLOT_TYPES.TEMPLATE_LOCK,
                templateId: template.id || null,
                createdBy: currentUserId || 'template',
                createdAt: Timestamp.now(),
                priority: template.priority || 'normal',
                category: template.category || 'other'
              });
              
              return { 
                success: true, 
                action: 'relocated', 
                conflicts: resolutionResult.conflicts 
              };
            }
          }
          
          // 競合解決が失敗した場合
          return { 
            success: false, 
            action: 'skipped', 
            conflicts: resolutionResult.conflicts 
          };
        }
      }
      
      // その他の場合はスキップ
      return { success: false, action: 'skipped', conflicts: [] };
    }
    
    // スロットが存在しない場合は新規作成
    tx.set(slotRef, {
      roomId: template.roomId,
      date: dateStr,
      period: String(period),
      reservationId: null,
      type: SLOT_TYPES.TEMPLATE_LOCK,
      templateId: template.id || null,
      createdBy: currentUserId || 'template',
      createdAt: Timestamp.now(),
      priority: template.priority || 'normal',
      category: template.category || 'other'
    });
    
    return { success: true, action: 'skipped', conflicts: [] };
  });
}



// 既存予約の取得
async function getExistingReservation(reservationId: string): Promise<any | null> {
  try {
    const reservationSnap = await getDocs(query(
      collection(db, COLLECTIONS.RESERVATIONS),
      where('__name__', '==', reservationId)
    ));
    
    if (!reservationSnap.empty) {
      const doc = reservationSnap.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    
    return null;
  } catch (error) {
    console.error('既存予約取得エラー:', error);
    return null;
  }
}

// 指定範囲のテンプレロックを削除（通常の予約も含む）
export async function removeTemplateLocks(
  rangeStart: string,
  rangeEnd: string,
  opts?: { roomId?: string; templateId?: string }
): Promise<{ deleted: number }> {
  let totalDeleted = 0;
  
  // 1. テンプレートロック（reservation_slots）の削除
  const slotConditions = [
    where('date', '>=', rangeStart),
    where('date', '<=', rangeEnd),
    where('type', '==', SLOT_TYPES.TEMPLATE_LOCK)
  ];
  if (opts?.roomId) slotConditions.push(where('roomId', '==', opts.roomId));
  if (opts?.templateId) slotConditions.push(where('templateId', '==', opts.templateId));

  const slotQuery = query(collection(db, RESERVATION_SLOTS_COLLECTION), ...slotConditions as any);
  const slotSnap = await getDocs(slotQuery);
  
  if (!slotSnap.empty) {
    let deleted = 0;
    let batch = writeBatch(db);
    let ops = 0;
    for (const d of slotSnap.docs) {
      batch.delete(d.ref);
      ops++; deleted++;
      if (ops >= 450) {
        await batch.commit();
        console.log(`... スロットバッチコミット (累計 ${deleted}/${slotSnap.size})`);
        batch = writeBatch(db); ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    console.log(`... スロット最終コミット (累計 ${deleted}/${slotSnap.size})`);
    totalDeleted += deleted;
  }

  // 2. 通常の予約（reservations）の削除（テンプレートから作成されたもの）
  const startDate = new Date(rangeStart);
  const endDate = new Date(rangeEnd);
  endDate.setHours(23, 59, 59, 999);
  
  const reservationConditions = [
    where('startTime', '>=', Timestamp.fromDate(startDate)),
    where('startTime', '<=', Timestamp.fromDate(endDate))
  ];
  if (opts?.roomId) reservationConditions.push(where('roomId', '==', opts.roomId));

  const reservationQuery = query(collection(db, 'reservations'), ...reservationConditions as any);
  const reservationSnap = await getDocs(reservationQuery);
  
  if (!reservationSnap.empty) {
    let deleted = 0;
    let batch = writeBatch(db);
    let ops = 0;
    
    for (const d of reservationSnap.docs) {
      const data = d.data();
      // テンプレートから作成された予約かどうかを判定
      // 作成者が管理者で、タイトルがテンプレート名と一致する場合
      if (data.createdBy && data.title && (
        opts?.templateId ? true : // テンプレートID指定の場合は全て削除
        data.createdBy.includes('cu1vyAtjBjTizSkCOsV2AxsMA6H2') // 管理者作成の予約
      )) {
        batch.delete(d.ref);
        ops++; deleted++;
        if (ops >= 450) {
          await batch.commit();
          console.log(`... 予約バッチコミット (累計 ${deleted})`);
          batch = writeBatch(db); ops = 0;
        }
      }
    }
    
    if (ops > 0) await batch.commit();
    console.log(`... 予約最終コミット (累計 ${deleted})`);
    totalDeleted += deleted;
  }

  return { deleted: totalDeleted };
}

// 新規追加: テンプレート別の固定予約削除
export async function removeTemplateLocksByTemplate(
  templateId: string,
  rangeStart?: string,
  rangeEnd?: string
): Promise<{ deleted: number; details: any[] }> {
  const conditions = [
    where('type', '==', SLOT_TYPES.TEMPLATE_LOCK),
    where('templateId', '==', templateId)
  ];
  
  if (rangeStart) conditions.push(where('date', '>=', rangeStart));
  if (rangeEnd) conditions.push(where('date', '<=', rangeEnd));

  const q = query(collection(db, RESERVATION_SLOTS_COLLECTION), ...conditions as any);
  const snap = await getDocs(q);
  
  if (snap.empty) return { deleted: 0, details: [] };

  const details = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  let deleted = 0;
  let batch = writeBatch(db);
  let ops = 0;
  
  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops++; deleted++;
    if (ops >= 450) {
      await batch.commit();
      console.log(`... バッチコミット (累計 ${deleted}/${snap.size})`);
      batch = writeBatch(db); ops = 0;
    }
  }
  
  if (ops > 0) await batch.commit();
  console.log(`... 最終コミット (累計 ${deleted}/${snap.size})`);
  
  return { deleted, details };
}

// 新規追加: 教室別の固定予約削除
export async function removeTemplateLocksByRoom(
  roomId: string,
  rangeStart?: string,
  rangeEnd?: string
): Promise<{ deleted: number; details: any[] }> {
  const conditions = [
    where('type', '==', SLOT_TYPES.TEMPLATE_LOCK),
    where('roomId', '==', roomId)
  ];
  
  if (rangeStart) conditions.push(where('date', '>=', rangeStart));
  if (rangeEnd) conditions.push(where('date', '<=', rangeEnd));

  const q = query(collection(db, RESERVATION_SLOTS_COLLECTION), ...conditions as any);
  const snap = await getDocs(q);
  
  if (snap.empty) return { deleted: 0, details: [] };

  const details = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  let deleted = 0;
  let batch = writeBatch(db);
  let ops = 0;
  
  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops++; deleted++;
    if (ops >= 450) {
      await batch.commit();
      console.log(`... バッチコミット (累計 ${deleted}/${snap.size})`);
      batch = writeBatch(db); ops = 0;
    }
  }
  
  if (ops > 0) await batch.commit();
  console.log(`... 最終コミット (累計 ${deleted}/${snap.size})`);
  
  return { deleted, details };
}

// 新規追加: 固定予約の統計情報取得
export async function getTemplateLocksStats(
  rangeStart?: string,
  rangeEnd?: string
): Promise<{
  total: number;
  byTemplate: { [templateId: string]: number };
  byRoom: { [roomId: string]: number };
  byDate: { [date: string]: number };
}> {
  const conditions = [where('type', '==', SLOT_TYPES.TEMPLATE_LOCK)];
  
  if (rangeStart) conditions.push(where('date', '>=', rangeStart));
  if (rangeEnd) conditions.push(where('date', '<=', rangeEnd));

  const q = query(collection(db, RESERVATION_SLOTS_COLLECTION), ...conditions as any);
  const snap = await getDocs(q);
  
  const stats = {
    total: 0,
    byTemplate: {} as { [templateId: string]: number },
    byRoom: {} as { [roomId: string]: number },
    byDate: {} as { [date: string]: number }
  };
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    stats.total++;
    
    // テンプレート別集計
    const templateId = data.templateId || 'unknown';
    stats.byTemplate[templateId] = (stats.byTemplate[templateId] || 0) + 1;
    
    // 教室別集計
    const roomId = data.roomId;
    stats.byRoom[roomId] = (stats.byRoom[roomId] || 0) + 1;
    
    // 日付別集計
    const date = data.date;
    stats.byDate[date] = (stats.byDate[date] || 0) + 1;
  });
  
  return stats;
}

// 新規追加: 固定予約の詳細一覧取得
export async function listTemplateLocks(
  rangeStart?: string,
  rangeEnd?: string,
  filters?: {
    templateId?: string;
    roomId?: string;
    priority?: TemplatePriority;
    category?: string;
  }
): Promise<Array<{
  id: string;
  roomId: string;
  date: string;
  period: string;
  templateId: string | null;
  priority: TemplatePriority;
  category: string;
  createdBy: string;
  createdAt: any;
}>> {
  const conditions = [where('type', '==', SLOT_TYPES.TEMPLATE_LOCK)];
  
  if (rangeStart) conditions.push(where('date', '>=', rangeStart));
  if (rangeEnd) conditions.push(where('date', '<=', rangeEnd));
  if (filters?.templateId) conditions.push(where('templateId', '==', filters.templateId));
  if (filters?.roomId) conditions.push(where('roomId', '==', filters.roomId));
  if (filters?.priority) conditions.push(where('priority', '==', filters.priority));
  if (filters?.category) conditions.push(where('category', '==', filters.category));

  const q = query(collection(db, RESERVATION_SLOTS_COLLECTION), ...conditions as any);
  const snap = await getDocs(q);
  
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];
}
