// Firestore データベース操作用のサービス
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch, // 追加
  runTransaction,
  QueryDocumentSnapshot,
  DocumentData,
  Transaction
} from 'firebase/firestore';
import { db } from './config';
import { formatPeriodDisplay, displayLabel } from '../utils/periodLabel';
import { PERIOD_ORDER as PERIOD_ORDER_CONST, periodTimeMap as PERIOD_TIME_MAP, createDateTimeFromPeriod as createDTFromPeriod } from '../utils/periods';
import { makeSlotId } from '../utils/slot';
import { toDateStr } from '../utils/dateRange';

// 教室の型定義
export interface Room {
  id?: string;
  name: string;
  description?: string;
  capacity?: number;
  createdAt?: Timestamp;
}

// 予約の型定義
export interface Reservation {
  id?: string;
  roomId: string;
  roomName: string;
  title: string;
  reservationName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  period: string;
  periodName: string;
  createdAt?: Timestamp;
  createdBy?: string;
}

// コレクション名
const ROOMS_COLLECTION = 'rooms';
const RESERVATIONS_COLLECTION = 'reservations';
const RESERVATION_SLOTS_COLLECTION = 'reservation_slots';

// 予約スロットの型（予約本体 or テンプレロック）
export interface ReservationSlot {
  roomId: string;
  date: string; // yyyy-mm-dd
  period: string; // '1','2','lunch','after' など
  reservationId?: string | null; // 予約本体がある場合
  type?: string; // 'template-lock' など
  templateId?: string | null;
}

// periodName 正規化（取得/追加両方で利用）
function normalizePeriodName(period: string, periodName: string): string {
  if (!period) return periodName;
  // 複数時限 (カンマ / ハイフン) は常に範囲として再計算
  if (period.includes(',') || period.includes('-')) {
    return formatPeriodDisplay(period, periodName);
  }
  const raw = periodName || '';
  if (period === 'lunch' || /lunch/i.test(raw)) return '昼休み';
  if (period === 'after' || /after/i.test(raw)) return '放課後';
  if (/^\d+$/.test(period)) return displayLabel(period); // `${period}限` と同義
  return periodName;
}

// CSV 用エスケープ（カンマ/改行/ダブルクォートを含む場合に二重引用）
function escapeCsv(value: any): string {
  const s = (value ?? '').toString();
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// 教室関連の操作
export const roomsService = {
  // 全教室を取得
  async getAllRooms(): Promise<Room[]> {
    try {
      const querySnapshot = await getDocs(collection(db, ROOMS_COLLECTION));
      const rooms = querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Room));
      // 依頼により「大演習室5」「大演習室6」は一覧から除外（全UIで非表示）
      const EXCLUDED_NAMES = new Set<string>(['大演習室5','大演習室6','大演習室５','大演習室６']);
      return rooms.filter(r => !EXCLUDED_NAMES.has(String(r.name)));
    } catch (error) {
      console.error('教室データ取得エラー:', error);
      throw error;
    }
  },

  // 教室を追加
  async addRoom(room: Omit<Room, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, ROOMS_COLLECTION), {
        ...room,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('教室追加エラー:', error);
      throw error;
    }
  }
};

// 予約関連の操作
export const reservationsService = {
  // 内部ユーティリティ: 日付文字列 (YYYY-MM-DD)
  _dateStr(ts: Timestamp): string {
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  // 内部ユーティリティ: period フィールドを配列化
  _periods(period: string): string[] {
    if (!period) return [];
    return period.includes(',') ? period.split(',').map(p => p.trim()).filter(Boolean) : [period];
  },
  // 期間内の予約を取得
  async getReservations(startDate: Date, endDate: Date): Promise<Reservation[]> {
    try {
      const q = query(
        collection(db, RESERVATIONS_COLLECTION),
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        orderBy('startTime', 'asc')
      );
      
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data() as Reservation;
        return {
            id: docSnap.id,
            ...data,
            // createdBy は UID を保持（過去データで未設定の場合のみ undefined）
            createdBy: data.createdBy || undefined,
            periodName: normalizePeriodName(data.period, data.periodName)
        };
      });
    } catch (error) {
      console.error('予約データ取得エラー:', error);
      throw error;
    }
  },

  // 予約を移動（旧スロット解放 → 新スロット確保 → 本体更新 を同一トランザクションで実施）
  async moveReservation(
    reservationId: string,
    newRoomId: string,
    newRoomName: string,
    newPeriod: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (tx: Transaction) => {
        const resRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
        const resSnap = await tx.get(resRef);
        if (!resSnap.exists()) {
          throw new Error('予約が見つかりません');
        }
        const data = resSnap.data() as Reservation;
        const dateStr = toDateStr((data.startTime as Timestamp).toDate());
        const oldPeriods = this._periods(data.period);
        const newPeriods = this._periods(newPeriod);

        // 新スロットの空きを確認（テンプレートロックや孤立スロットは上書き/掃除）
        for (const p of newPeriods) {
          const slotId = makeSlotId(newRoomId, dateStr, p);
          const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
          const slotSnap = await tx.get(slotRef);
          if (slotSnap.exists()) {
            const slotData = slotSnap.data() as ReservationSlot;
            if (slotData.type === 'template-lock') {
              // ロックは上書きして確保
              tx.delete(slotRef);
            } else if (!slotData.reservationId) {
              // 孤立スロットは掃除
              tx.delete(slotRef);
            } else {
              // 参照先予約の存在確認（存在しなければ掃除）
              const ref = doc(db, RESERVATIONS_COLLECTION, String(slotData.reservationId));
              const snap = await tx.get(ref);
              if (!snap.exists()) {
                tx.delete(slotRef);
              } else {
                throw new Error('同じ教室・時限の予約が既に存在します');
              }
            }
          }
        }

        // 旧スロット開放
        for (const p of oldPeriods) {
          const oldSlotId = makeSlotId(data.roomId, dateStr, p);
          const oldSlotRef = doc(db, RESERVATION_SLOTS_COLLECTION, oldSlotId);
          tx.delete(oldSlotRef);
        }

        // 新しい開始/終了時刻と periodName を算出
        let startTime: Timestamp = data.startTime;
        let endTime: Timestamp = data.endTime;
        let periodName: string = data.periodName;
        if (newPeriods.length === 1) {
          const dt = createDTFromPeriod(dateStr, newPeriods[0]);
          if (!dt) throw new Error('新しい時限の時間計算に失敗しました');
          startTime = Timestamp.fromDate(dt.start);
          endTime = Timestamp.fromDate(dt.end);
          periodName = displayLabel(newPeriods[0]);
        } else if (newPeriods.length > 1) {
          const startP = newPeriods[0];
          const endP = newPeriods[newPeriods.length - 1];
          const dtStart = createDTFromPeriod(dateStr, startP);
          const dtEnd = createDTFromPeriod(dateStr, endP);
          if (!dtStart || !dtEnd) throw new Error('新しい時限範囲の時間計算に失敗しました');
          startTime = Timestamp.fromDate(dtStart.start);
          endTime = Timestamp.fromDate(dtEnd.end);
          periodName = formatPeriodDisplay(newPeriod);
        }

        // 本体更新
        tx.update(resRef, {
          roomId: newRoomId,
          roomName: newRoomName,
          period: newPeriod,
          periodName,
          startTime,
          endTime
        });

        // 新スロット確保
        for (const p of newPeriods) {
          const newSlotId = makeSlotId(newRoomId, dateStr, p);
          const newSlotRef = doc(db, RESERVATION_SLOTS_COLLECTION, newSlotId);
          tx.set(newSlotRef, {
            roomId: newRoomId,
            date: dateStr,
            period: p,
            reservationId: reservationId,
            createdBy: data.createdBy || null,
            createdAt: Timestamp.now()
          });
        }
      });
    } catch (error) {
      console.error('予約移動エラー:', error);
      throw error;
    }
  },

  // 期間内の予約をCSV文字列としてエクスポート
  async exportReservationsCsv(rangeStart: string, rangeEnd: string, opts?: { roomId?: string; includeId?: boolean; includeCreatedAt?: boolean; includeCreatedByUid?: boolean }): Promise<string> {
    // ヘッダー基本: 日付,教室,タイトル,予約者,時限,時刻(開始-終了)
    const header = ['date','room','title','reservedBy','period','timeRange'];
    if (opts?.includeId) header.push('reservationId');
    if (opts?.includeCreatedAt) header.push('createdAt');
    if (opts?.includeCreatedByUid) header.push('createdBy');
    const start = new Date(rangeStart); start.setHours(0,0,0,0);
    const end = new Date(rangeEnd); end.setHours(23,59,59,999);
    const list = opts?.roomId
      ? await this.getRoomReservations(String(opts.roomId), start, end)
      : await this.getReservations(start, end);
    const lines: string[] = [header.join(',')];
    for (const r of list) {
      const d = (r.startTime as Timestamp).toDate();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const startD = (r.startTime as Timestamp).toDate();
      const endD = (r.endTime as Timestamp).toDate();
      const timeRange = `${startD.getHours().toString().padStart(2,'0')}:${startD.getMinutes().toString().padStart(2,'0')}-${endD.getHours().toString().padStart(2,'0')}:${endD.getMinutes().toString().padStart(2,'0')}`;
      const periodDisp = normalizePeriodName(r.period, r.periodName);
      const cells = [
        dateStr,
        escapeCsv(r.roomName),
        escapeCsv(r.title || ''),
        escapeCsv(r.reservationName || r.createdBy || ''),
        escapeCsv(periodDisp),
        timeRange
      ];
      if (opts?.includeId) cells.push(escapeCsv(r.id || ''));
      if (opts?.includeCreatedAt) cells.push((r.createdAt instanceof Timestamp ? r.createdAt.toDate() : new Date()).toISOString());
      if (opts?.includeCreatedByUid) cells.push(escapeCsv(r.createdBy || ''));
      lines.push(cells.join(','));
    }
    return lines.join('\n');
  },

  // 特定教室の予約を取得
  async getRoomReservations(roomId: string, startDate: Date, endDate: Date): Promise<Reservation[]> {
    try {
      const q = query(
        collection(db, RESERVATIONS_COLLECTION),
        where('roomId', '==', roomId),
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        orderBy('startTime', 'asc')
      );
      
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data() as Reservation;
        return {
          id: docSnap.id,
          ...data,
          createdBy: data.createdBy || undefined,
          periodName: normalizePeriodName(data.period, data.periodName)
        };
      });
    } catch (error) {
      console.error('教室予約データ取得エラー:', error);
      throw error;
    }
  },

  // 予約を追加
  async addReservation(reservation: Omit<Reservation, 'id'>): Promise<string> {
    try {
      const fixed = {
        ...reservation,
        periodName: normalizePeriodName(reservation.period, reservation.periodName),
        createdAt: Timestamp.now()
      };
      // スロット一意性を保証するためトランザクションを使用
  const newResRef = doc(collection(db, RESERVATIONS_COLLECTION)); // 先にIDを確保
  const dateStr = toDateStr((fixed.startTime as Timestamp).toDate());
      const periods = this._periods(fixed.period);

  await runTransaction(db, async (tx: Transaction) => {
        // スロット存在チェック（テンプレートロックは無視）
        for (const p of periods) {
          const slotId = makeSlotId(fixed.roomId, dateStr, p);
          const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
          const slotSnap = await tx.get(slotRef);
          if (slotSnap.exists()) {
            const slotData = slotSnap.data() as ReservationSlot;
            // テンプレートロック（type: "template-lock"）は無視して上書き
            if (slotData.type === 'template-lock') {
              console.log(`🔓 テンプレートロックを上書き: ${slotId}`);
              tx.delete(slotRef);
              continue;
            }

            // 予約スロットだが reservationId が欠落 → 孤立スロットとして自動削除
            if (!slotData.reservationId) {
              console.warn(`🧹 孤立スロットを自動削除 (reservationIdなし): ${slotId}`);
              tx.delete(slotRef);
              continue;
            }

            // 予約スロットだが参照先予約が存在しない → 孤立スロットとして自動削除
            try {
              const resRef = doc(db, RESERVATIONS_COLLECTION, String(slotData.reservationId));
              const resSnap = await tx.get(resRef);
              if (!resSnap.exists()) {
                console.warn(`🧹 孤立スロットを自動削除 (予約欠落): ${slotId} -> ${slotData.reservationId}`);
                tx.delete(slotRef);
                continue;
              }
            } catch (e) {
              console.warn('⚠️ 予約参照チェック中エラー: ', slotData.reservationId, e);
            }

            // 正常な予約スロットが既にあるため、重複扱い
            throw new Error('同じ教室・時限の予約が既に存在します');
          }
        }

        // 予約本体を作成
        tx.set(newResRef, fixed);
        // スロットを確保
        for (const p of periods) {
          const slotId = makeSlotId(fixed.roomId, dateStr, p);
          const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
          tx.set(slotRef, {
            roomId: fixed.roomId,
            date: dateStr,
            period: p,
            reservationId: newResRef.id,
            createdBy: fixed.createdBy || null,
            createdAt: Timestamp.now()
          });
        }
      });

      return newResRef.id;
    } catch (error) {
      console.error('予約追加エラー:', error);
      throw error;
    }
  },

  // 指定日付のスロット（予約またはロック）を取得
  async getSlotsForDate(dateStr: string): Promise<ReservationSlot[]> {
    try {
      const q = query(
        collection(db, RESERVATION_SLOTS_COLLECTION),
        where('date', '==', dateStr)
      );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as ReservationSlot);
    } catch (error) {
      console.error('スロット取得エラー:', error);
      return [];
    }
  },

  // 予約を更新
  async updateReservation(reservationId: string, updates: Partial<Reservation>): Promise<void> {
    try {
      await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), updates);
    } catch (error) {
      console.error('予約更新エラー:', error);
      throw error;
    }
  },

  // 予約を削除
  async deleteReservation(reservationId: string): Promise<void> {
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const attempt = async () => {
      await runTransaction(db, async (tx: Transaction) => {
        const resRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
        const snap = await tx.get(resRef);
        if (!snap.exists()) {
          return;
        }
        const data = snap.data() as Reservation;
        const dateStr = toDateStr((data.startTime as Timestamp).toDate());
        const periods = this._periods(data.period);
        // 本体削除
        tx.delete(resRef);
        // スロット開放
        for (const p of periods) {
          const slotId = makeSlotId(data.roomId, dateStr, p);
          const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
          tx.delete(slotRef);
        }
      });
    };
    let lastErr: any = null;
    for (let i = 0; i < 3; i++) {
      try {
        await attempt();
        return;
      } catch (error: any) {
        lastErr = error;
        const code = (error && (error.code || error?.message)) || '';
        // リソース枯渇/競合は指数バックオフで再試行
        if (typeof code === 'string' && (/resource-exhausted/i.test(code) || /aborted/i.test(code) || /Too Many Requests/i.test(code))) {
          await sleep(400 * Math.pow(2, i));
          continue;
        }
        break;
      }
    }
    console.error('予約削除エラー:', lastErr);
    throw lastErr;
  },

  // 読み取りを行わず、既知の予約情報を用いて削除（429対策）
  async deleteReservationWithKnown(reservation: Reservation): Promise<void> {
    const dateStr = toDateStr((reservation.startTime as Timestamp).toDate());
    const periods = this._periods(reservation.period);
    await runTransaction(db, async (tx: Transaction) => {
      const resRef = doc(db, RESERVATIONS_COLLECTION, String(reservation.id));
      // 本体削除（存在しなくても no-op 扱い）
      tx.delete(resRef);
      // スロット開放
      for (const p of periods) {
        const slotId = makeSlotId(reservation.roomId, dateStr, p);
        const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
        tx.delete(slotRef);
      }
    });
  },

  // 管理者機能：全ての予約を削除
  async deleteAllReservations(): Promise<void> { // 旧方式（小規模データ向け）
    try {
      console.log('🗑️ 全予約データ削除開始...(旧方式) auth.uid=', (await import('./config')).auth?.currentUser?.uid);
      const querySnapshot = await getDocs(collection(db, RESERVATIONS_COLLECTION));
      if (querySnapshot.docs.length === 0) {
        console.log('削除する予約データがありません');
        return;
      }
  const deletePromises = querySnapshot.docs.map((docRef: QueryDocumentSnapshot<DocumentData>) => deleteDoc(docRef.ref));
      await Promise.all(deletePromises);
      console.log(`✅ ${querySnapshot.docs.length}件の予約データを削除しました`);
    } catch (error) {
      console.error('❌ 全削除エラー:', error);
      throw error;
    }
  },

  // バッチ版一括削除（推奨）: 500件ずつ commit
  async deleteAllReservationsBatch(): Promise<number> {
    try {
      const { auth } = await import('./config');
      console.log('🗑️ 全予約データ(バッチ)削除開始 auth.uid=', auth.currentUser?.uid || 'NONE');
      const snap = await getDocs(collection(db, RESERVATIONS_COLLECTION));
      const total = snap.docs.length;
      console.log('取得ドキュメント総数(collection直):', total);
      if (total === 0) {
        return 0;
      }
      let processed = 0;
      let batch = writeBatch(db);
      let ops = 0;
      for (const d of snap.docs) {
        const data = d.data() as Reservation;
        const dateStr = toDateStr((data.startTime as Timestamp).toDate());
        const periods = this._periods(data.period);
        // 予約本体
        batch.delete(d.ref);
        ops++; processed++;
        // スロット
        for (const p of periods) {
          const slotId = makeSlotId(data.roomId, dateStr, p);
          const slotRef = doc(db, RESERVATION_SLOTS_COLLECTION, slotId);
          batch.delete(slotRef);
          ops++;
        }
        if (ops >= 450) { // スロット分もあるので余裕を持ってコミット
          await batch.commit();
          console.log(`... バッチコミット (累計 ${processed}/${total})`);
          batch = writeBatch(db); ops = 0;
        }
      }
      if (ops > 0) {
        await batch.commit();
        console.log(`... 最終コミット (累計 ${processed}/${total})`);
      }
      console.log(`✅ 一括削除完了 合計 ${processed}件`);
      return processed;
    } catch (error) {
      console.error('❌ バッチ一括削除エラー', error);
      throw error;
    }
  },

  // 追加: startTime 広域レンジで再取得→順次 delete (手動削除が成功するケースに近い)
  async deleteAllReservationsWideRange(): Promise<number> {
    const startDate = new Date(2000,0,1);
    const endDate = new Date(2100,0,1);
    console.log('🔎 WideRange 取得開始', startDate.toISOString(), endDate.toISOString());
    const list = await this.getReservations(startDate, endDate);
    console.log('WideRange ヒット件数:', list.length);
    let deleted = 0;
    for (const r of list) {
      if (r.id) {
        try {
          await this.deleteReservation(r.id);
          deleted++;
        } catch(e) {
          console.warn('個別削除失敗', r.id, e);
        }
      }
    }
    console.log('WideRange 削除完了 件数:', deleted);
    return deleted;
  },

  // デバッグ: 全ID列挙
  async listAllReservationIds(): Promise<string[]> {
    const snap = await getDocs(collection(db, RESERVATIONS_COLLECTION));
  const ids = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.id);
    console.log('📄 [DEBUG][RESERVATIONS] 全ID一覧:', ids);
    return ids;
  },

  // 予約IDで取得
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    try {
      const docSnap = await getDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
      if (docSnap.exists()) {
        const data = docSnap.data() as Reservation;
        return {
          id: docSnap.id,
          ...data,
          createdBy: data.createdBy || undefined,
          periodName: normalizePeriodName(data.period, data.periodName)
        };
      }
      return null;
    } catch (error) {
      console.error('予約取得エラー:', error);
      throw error;
    }
  },

  // 特定日の予約を取得
  async getDayReservations(date: Date): Promise<Reservation[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return await this.getReservations(startOfDay, endOfDay);
    } catch (error) {
      console.error('日別予約取得エラー:', error);
      throw error;
    }
  },

  // 期間内の予約を一括削除（オプションで roomId / createdBy で絞り込み）
  async deleteReservationsInRange(
    rangeStart: string,
    rangeEnd: string,
    opts?: { roomId?: string; createdBy?: string }
  ): Promise<number> {
    try {
      const startDate = new Date(rangeStart);
      // 開始日は一日の始まり（ローカル時刻）に丸める（UTCズレ対策）
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(rangeEnd);
      // 終了日は一日の終わり（ローカル時刻）に丸める
      endDate.setHours(23, 59, 59, 999);

      const conditions: any[] = [
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate))
      ];
      if (opts?.roomId) conditions.push(where('roomId', '==', opts.roomId));
      if (opts?.createdBy) conditions.push(where('createdBy', '==', opts.createdBy));

      const q = query(collection(db, RESERVATIONS_COLLECTION), ...conditions as any);
      const snap = await getDocs(q);
      if (snap.empty) return 0;

      let deleted = 0;
      let ops = 0;
      let batch = writeBatch(db);
      for (const d of snap.docs) {
        const data = d.data() as Reservation;
        const dateStr = toDateStr((data.startTime as Timestamp).toDate());
        const periods = this._periods(data.period);
        // 予約本体
        batch.delete(d.ref);
        ops++; deleted++;
        // スロット
        for (const p of periods) {
          const slotId = makeSlotId(data.roomId, dateStr, p);
          batch.delete(doc(db, RESERVATION_SLOTS_COLLECTION, slotId));
          ops++;
        }
        if (ops >= 450) {
          await batch.commit();
          batch = writeBatch(db); ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
      return deleted;
    } catch (error) {
      console.error('期間削除エラー:', error);
      throw error;
    }
  }
};

// 時限から日時を作成するヘルパー関数
export function createDateTimeFromPeriod(dateStr: string, period: string) {
  return createDTFromPeriod(dateStr, period);
}

// 順序・型を utils/periods から再エクスポート（後方互換）
export const periodTimeMap = PERIOD_TIME_MAP;
export const PERIOD_ORDER = PERIOD_ORDER_CONST;
export type PeriodKey = typeof PERIOD_ORDER_CONST[number];
