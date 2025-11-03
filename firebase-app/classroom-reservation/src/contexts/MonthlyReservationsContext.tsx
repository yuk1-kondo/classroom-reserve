import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';

interface MonthlyReservationsContextValue {
  reservations: Reservation[];
  setRange: (start: Date, end: Date) => void;
  refetch: () => Promise<void>;
}

const MonthlyReservationsContext = createContext<MonthlyReservationsContextValue | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
}

export const MonthlyReservationsProvider: React.FC<ProviderProps> = ({ children }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const rangeRef = useRef<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const inflightRef = useRef<Promise<void> | null>(null);

  // 初回フル取得の基準時刻と対象月を保持（以降は差分）
  const baseMonthIdRef = useRef<string | null>(null);
  const baseFetchedAtMsRef = useRef<number | null>(null);

  const load = useCallback(async (start: Date | null, end: Date | null) => {
    if (!start || !end) {
      setReservations([]);
      return;
    }
    try {
      // 表示範囲の中間日付の月（該当月）を決定
      const midTime = Math.floor((start.getTime() + end.getTime()) / 2);
      const mid = new Date(midTime);
      const monthId = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}`;
      // 月が変わった/未同期なら: その月をフルでFirestoreから取得
      const monthStart = new Date(mid.getFullYear(), mid.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(mid.getFullYear(), mid.getMonth() + 1, 0, 23, 59, 59, 999);
      if (baseMonthIdRef.current !== monthId || !baseFetchedAtMsRef.current) {
        const full = await reservationsService.getReservations(monthStart, monthEnd);
        setReservations(Array.isArray(full) ? full : []);
        baseMonthIdRef.current = monthId;
        baseFetchedAtMsRef.current = Date.now();
        return;
      }

      // 同一月: 差分のみ取得（updatedAt優先、createdAtフォロー）
      const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase/config');
      const since = Timestamp.fromMillis(baseFetchedAtMsRef.current);
      const qUpdated = query(
        collection(db, 'reservations'),
        where('updatedAt', '>', since),
        orderBy('updatedAt', 'asc')
      );
      const qCreated = query(
        collection(db, 'reservations'),
        where('createdAt', '>', since),
        orderBy('createdAt', 'asc')
      );
      const [snapUpdated, snapCreated] = await Promise.all([
        getDocs(qUpdated).catch(() => ({ docs: [] as any[] } as any)),
        getDocs(qCreated).catch(() => ({ docs: [] as any[] } as any))
      ]);
      const updatedList = (snapUpdated.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as Reservation));
      const createdList = (snapCreated.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as Reservation));
      const allDiffReservations: Reservation[] = [];
      const seen = new Set<string>();
      for (const r of [...updatedList, ...createdList]) {
        const id = String(r.id || '');
        if (!seen.has(id)) { seen.add(id); allDiffReservations.push(r); }
      }
      const diffReservations = allDiffReservations.filter(r => {
        const st: Date = (r.startTime as any)?.toDate?.() || new Date(r.startTime as any);
        return st >= monthStart && st <= monthEnd;
      });
      const mergedMap = new Map<string, Reservation>();
      reservations.forEach(r => r.id && mergedMap.set(r.id, r));
      diffReservations.forEach(r => r.id && mergedMap.set(r.id, r));
      setReservations(Array.from(mergedMap.values()));
      baseFetchedAtMsRef.current = Date.now();
      return;
    } catch (error) {
      console.error('予約読み込みエラー:', error);
      setReservations([]);
    }
  }, [reservations]);

  const setRange = useCallback((start: Date, end: Date) => {
    if (!start || !end) return;

    const prev = rangeRef.current;
    const sameRange =
      prev.start?.getTime() === start.getTime() &&
      prev.end?.getTime() === end.getTime();

    if (sameRange) {
      return;
    }

    rangeRef.current = { start, end };
    inflightRef.current = load(start, end);
  }, [load]);

  const refetch = useCallback(async () => {
    console.log('🔄 MonthlyReservations: refetch開始');
    const { start, end } = rangeRef.current;
    console.log('📅 現在の範囲:', { start, end });
    // キャッシュをクリアして強制的にフル取得（削除された予約を反映）
    baseMonthIdRef.current = null;
    baseFetchedAtMsRef.current = null;
    inflightRef.current = load(start, end);
    await inflightRef.current;
    console.log('✅ MonthlyReservations: refetch完了, 予約数:', reservations.length);
  }, [load, reservations.length]);

  const value = useMemo<MonthlyReservationsContextValue>(() => ({
    reservations,
    setRange,
    refetch
  }), [reservations, setRange, refetch]);

  return (
    <MonthlyReservationsContext.Provider value={value}>
      {children}
    </MonthlyReservationsContext.Provider>
  );
};

export function useMonthlyReservations(): MonthlyReservationsContextValue {
  const ctx = useContext(MonthlyReservationsContext);
  if (!ctx) throw new Error('useMonthlyReservations must be used within MonthlyReservationsProvider');
  return ctx;
}


