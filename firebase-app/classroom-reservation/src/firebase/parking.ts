/**
 * 駐車場予約（教室の rooms / reservations とは完全に分離）
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  Transaction,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS, PARKING_SETTINGS_DOC_ID } from '../constants/collections';
import { PARKING_SPOTS, PARKING_SPOT_ORDER, ParkingAccessMode } from '../constants/parking';
import { Reservation, ReservationSlot, Room } from './firestore';
import { makeSlotId } from '../utils/slot';
import { toDateStr } from '../utils/dateRange';
import { formatPeriodDisplay, displayLabel } from '../utils/periodLabel';
import { createDateTimeFromPeriod } from '../utils/periods';

export type ParkingSpot = Room;

export interface ParkingMemberRecord {
  uid: string;
  active?: boolean;
  canDelete?: boolean;
  addedAt?: Timestamp;
  addedBy?: string;
}

export interface ParkingSettings {
  accessMode?: ParkingAccessMode;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export function isParkingMembershipActive(data: { active?: boolean }): boolean {
  return data.active !== false;
}

function normalizePeriodName(period: string, periodName: string): string {
  if (!period) return periodName;
  if (period.includes(',') || period.includes('-')) {
    return formatPeriodDisplay(period, periodName);
  }
  const raw = periodName || '';
  if (period === 'lunch' || /lunch/i.test(raw)) return '昼休み';
  if (period === 'after' || /after/i.test(raw)) return '放課後';
  if (/^\d+$/.test(period)) return displayLabel(period);
  return periodName;
}

function periodsOf(period: string): string[] {
  if (!period) return [];
  return period.includes(',') ? period.split(',').map(p => p.trim()).filter(Boolean) : [period];
}

function mapReservation(docSnap: QueryDocumentSnapshot<DocumentData>): Reservation {
  const data = docSnap.data() as Reservation;
  return {
    ...data,
    id: docSnap.id,
    createdBy: data.createdBy || undefined,
    periodName: normalizePeriodName(data.period, data.periodName)
  };
}

export const parkingSettingsService = {
  async getAccessMode(): Promise<ParkingAccessMode> {
    const snap = await getDoc(doc(db, COLLECTIONS.SYSTEM_SETTINGS, PARKING_SETTINGS_DOC_ID));
    if (!snap.exists()) return 'group';
    const mode = (snap.data() as ParkingSettings).accessMode;
    return mode === 'public' ? 'public' : 'group';
  },

  async setAccessMode(accessMode: ParkingAccessMode, updatedBy: string): Promise<void> {
    await setDoc(
      doc(db, COLLECTIONS.SYSTEM_SETTINGS, PARKING_SETTINGS_DOC_ID),
      { accessMode, updatedBy, updatedAt: Timestamp.now() },
      { merge: true }
    );
  }
};

export const parkingPrivilegeService = {
  async getMembership(uid: string): Promise<ParkingMemberRecord | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.PARKING_GROUP_MEMBERS, uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...(snap.data() as object) } as ParkingMemberRecord;
  },

  async isMember(uid: string): Promise<boolean> {
    const rec = await this.getMembership(uid);
    if (!rec) return false;
    return isParkingMembershipActive(rec);
  },

  async listMembers(): Promise<ParkingMemberRecord[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.PARKING_GROUP_MEMBERS));
    return snap.docs.map(d => ({ uid: d.id, ...(d.data() as object) } as ParkingMemberRecord));
  },

  async addMember(uid: string, addedBy: string, canDelete = false): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.PARKING_GROUP_MEMBERS, uid), {
      active: true,
      canDelete,
      addedAt: Timestamp.now(),
      addedBy
    });
  },

  async setCanDelete(uid: string, canDelete: boolean): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.PARKING_GROUP_MEMBERS, uid), { canDelete }, { merge: true });
  },

  async removeMember(uid: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.PARKING_GROUP_MEMBERS, uid));
  }
};

export const parkingSpotsService = {
  async ensureSpots(): Promise<{ added: string[]; skipped: string[] }> {
    const added: string[] = [];
    const skipped: string[] = [];
    for (const template of PARKING_SPOTS) {
      const ref = doc(db, COLLECTIONS.PARKING_SPOTS, template.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        skipped.push(template.name);
        continue;
      }
      await setDoc(ref, {
        name: template.name,
        description: template.description,
        createdAt: Timestamp.now()
      });
      added.push(template.name);
    }
    return { added, skipped };
  },

  async getAllSpots(): Promise<ParkingSpot[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.PARKING_SPOTS));
    const list = snap.docs.map(d => ({ ...(d.data() as object), id: d.id })) as ParkingSpot[];
    const order = new Map<string, number>(PARKING_SPOT_ORDER.map((id, i) => [id, i]));
    return list.sort((a, b) => {
      const ai = order.has(String(a.id)) ? order.get(String(a.id))! : Number.MAX_SAFE_INTEGER;
      const bi = order.has(String(b.id)) ? order.get(String(b.id))! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a.name).localeCompare(String(b.name), 'ja');
    });
  }
};

export const parkingReservationsService = {
  async getReservations(startDate: Date, endDate: Date): Promise<Reservation[]> {
    const q = query(
      collection(db, COLLECTIONS.PARKING_RESERVATIONS),
      where('startTime', '>=', Timestamp.fromDate(startDate)),
      where('startTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('startTime', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapReservation);
  },

  async getReservationById(reservationId: string): Promise<Reservation | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.PARKING_RESERVATIONS, reservationId));
    if (!snap.exists()) return null;
    return mapReservation(snap as QueryDocumentSnapshot<DocumentData>);
  },

  async addReservation(reservation: Omit<Reservation, 'id'>): Promise<string> {
    const fixed = {
      ...reservation,
      periodName: normalizePeriodName(reservation.period, reservation.periodName),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    const newResRef = doc(collection(db, COLLECTIONS.PARKING_RESERVATIONS));
    const dateStr = toDateStr((fixed.startTime as Timestamp).toDate());
    const periods = periodsOf(fixed.period);

    await runTransaction(db, async (tx: Transaction) => {
      for (const p of periods) {
        const slotId = makeSlotId(fixed.roomId, dateStr, p);
        const slotRef = doc(db, COLLECTIONS.PARKING_SLOTS, slotId);
        const slotSnap = await tx.get(slotRef);
        if (slotSnap.exists()) {
          const slotData = slotSnap.data() as ReservationSlot;
          if (!slotData.reservationId) {
            tx.delete(slotRef);
            continue;
          }
          const resRef = doc(db, COLLECTIONS.PARKING_RESERVATIONS, String(slotData.reservationId));
          const resSnap = await tx.get(resRef);
          if (!resSnap.exists()) {
            tx.delete(slotRef);
            continue;
          }
          throw new Error('同じ駐車場・時限の予約が既に存在します');
        }
      }
      tx.set(newResRef, fixed);
      for (const p of periods) {
        const slotId = makeSlotId(fixed.roomId, dateStr, p);
        tx.set(doc(db, COLLECTIONS.PARKING_SLOTS, slotId), {
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
  },

  async updateReservation(reservationId: string, updates: Partial<Reservation>): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.PARKING_RESERVATIONS, reservationId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  async deleteReservation(reservation: Reservation): Promise<void> {
    if (!reservation.id) return;
    const dateStr = toDateStr((reservation.startTime as Timestamp).toDate());
    const periods = periodsOf(reservation.period);
    await runTransaction(db, async (tx: Transaction) => {
      const resRef = doc(db, COLLECTIONS.PARKING_RESERVATIONS, String(reservation.id));
      const snap = await tx.get(resRef);
      if (!snap.exists()) return;
      tx.delete(resRef);
      for (const p of periods) {
        tx.delete(doc(db, COLLECTIONS.PARKING_SLOTS, makeSlotId(reservation.roomId, dateStr, p)));
      }
    });
  },

  async deletePartialPeriods(reservationId: string, periodsToDelete: string[]): Promise<void> {
    await runTransaction(db, async (tx: Transaction) => {
      const resRef = doc(db, COLLECTIONS.PARKING_RESERVATIONS, reservationId);
      const snap = await tx.get(resRef);
      if (!snap.exists()) throw new Error('予約が見つかりません');
      const data = snap.data() as Reservation;
      const dateStr = toDateStr((data.startTime as Timestamp).toDate());
      const allPeriods = periodsOf(data.period);
      const remaining = allPeriods.filter(p => !periodsToDelete.includes(p.trim()));

      if (remaining.length === 0) {
        tx.delete(resRef);
        for (const p of allPeriods) {
          tx.delete(doc(db, COLLECTIONS.PARKING_SLOTS, makeSlotId(data.roomId, dateStr, p)));
        }
        return;
      }

      for (const p of periodsToDelete) {
        tx.delete(doc(db, COLLECTIONS.PARKING_SLOTS, makeSlotId(data.roomId, dateStr, p)));
      }

      if (remaining.length === 1) {
        const single = remaining[0];
        const dt = createDateTimeFromPeriod(dateStr, single);
        if (!dt) throw new Error('時限の日時作成に失敗しました');
        tx.update(resRef, {
          period: single,
          periodName: dt.periodName || displayLabel(single),
          startTime: Timestamp.fromDate(dt.start),
          endTime: Timestamp.fromDate(dt.end),
          updatedAt: Timestamp.now()
        });
        return;
      }

      const first = remaining[0];
      const last = remaining[remaining.length - 1];
      const dtStart = createDateTimeFromPeriod(dateStr, first);
      const dtEnd = createDateTimeFromPeriod(dateStr, last);
      if (!dtStart || !dtEnd) throw new Error('時限範囲の時間計算に失敗しました');
      tx.update(resRef, {
        period: remaining.join(','),
        periodName: `${displayLabel(first)}〜${displayLabel(last)}`,
        startTime: Timestamp.fromDate(dtStart.start),
        endTime: Timestamp.fromDate(dtEnd.end),
        updatedAt: Timestamp.now()
      });
    });
  }
};
