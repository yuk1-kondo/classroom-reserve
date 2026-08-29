import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';

type LoadResult = 'ok' | 'stale' | 'error';

interface MonthlyReservationsContextValue {
  reservations: Reservation[];
  loading: boolean;
  setRange: (start: Date, end: Date) => void;
  /** ログアウト時など、保持中の範囲・予約一覧を破棄する */
  clearReservations: () => void;
  refetch: () => Promise<void>;
  addReservations: (newReservations: Reservation[]) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  removeReservation: (id: string) => void;
}

const MonthlyReservationsContext = createContext<MonthlyReservationsContextValue | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const MonthlyReservationsProvider: React.FC<ProviderProps> = ({ children }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  /** 初回 setRange 完了まで true。台帳が空セルで先に出ないようにする */
  const [loading, setLoading] = useState<boolean>(true);
  const rangeRef = useRef<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const inflightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (
    start: Date | null,
    end: Date | null,
    opts?: { noCache?: boolean; fromServer?: boolean }
  ): Promise<LoadResult> => {
    if (!start || !end) {
      setReservations([]);
      return 'ok';
    }

    const requestedStart = start.getTime();
    const requestedEnd = end.getTime();

    try {
      console.log('🔍 MonthlyReservationsContext.load called:', {
        start: start.toISOString(),
        end: end.toISOString(),
        rangeDays: Math.ceil((end.getTime() - start.getTime()) / 86400000)
      });
      const full = await reservationsService.getReservations(start, end, opts);
      console.log(`📦 Loaded ${full.length} reservations for range ${start.toISOString().slice(0, 10)} ~ ${end.toISOString().slice(0, 10)}`);

      const current = rangeRef.current;
      if (current.start?.getTime() === requestedStart && current.end?.getTime() === requestedEnd) {
        setReservations(Array.isArray(full) ? full : []);
        return 'ok';
      }
      console.log('⏭️ 古いリクエストの結果をスキップ（日付が既に変更済み）');
      return 'stale';
    } catch (error) {
      const current = rangeRef.current;
      if (current.start?.getTime() === requestedStart && current.end?.getTime() === requestedEnd) {
        console.error('予約読み込みエラー:', error);
        setReservations([]);
        return 'error';
      }
      console.log('⏭️ 古いリクエストのエラーをスキップ（日付が既に変更済み）');
      return 'stale';
    }
  }, []);

  const loadWithRetry = useCallback(async (
    start: Date,
    end: Date,
    opts?: { noCache?: boolean; fromServer?: boolean }
  ) => {
    const requestStart = start.getTime();
    const requestEnd = end.getTime();
    const result = await load(start, end, opts);
    if (result !== 'error') return;
    await sleep(400);
    const current = rangeRef.current;
    if (current.start?.getTime() !== requestStart || current.end?.getTime() !== requestEnd) return;
    await load(start, end, { noCache: true, fromServer: true });
  }, [load]);

  const clearReservations = useCallback(() => {
    rangeRef.current = { start: null, end: null };
    setReservations([]);
    setLoading(false);
  }, []);

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
    setLoading(true);

    const requestStart = start.getTime();
    const requestEnd = end.getTime();

    inflightRef.current = (async () => {
      await loadWithRetry(start, end);
      const current = rangeRef.current;
      if (current.start?.getTime() === requestStart && current.end?.getTime() === requestEnd) {
        setLoading(false);
      }
    })();
  }, [loadWithRetry]);

  const refetch = useCallback(async () => {
    const { start, end } = rangeRef.current;
    if (!start || !end) return;
    const requestStart = start.getTime();
    const requestEnd = end.getTime();
    setLoading(true);
    inflightRef.current = (async () => {
      await loadWithRetry(start, end, { noCache: true, fromServer: true });
      const current = rangeRef.current;
      if (current.start?.getTime() === requestStart && current.end?.getTime() === requestEnd) {
        setLoading(false);
      }
    })();
    await inflightRef.current;
  }, [loadWithRetry]);

  const addReservations = useCallback((newReservations: Reservation[]) => {
    setReservations(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = newReservations.filter(r => !existingIds.has(r.id));
      console.log(`➕ MonthlyReservationsContext: ${toAdd.length}件の予約を追加`);
      return [...prev, ...toAdd].sort((a, b) => {
        const aTime = (a.startTime as Timestamp).toMillis();
        const bTime = (b.startTime as Timestamp).toMillis();
        return aTime - bTime;
      });
    });
  }, []);

  const updateReservation = useCallback((id: string, updates: Partial<Reservation>) => {
    setReservations(prev => {
      return prev.map(r => (r.id === id ? { ...r, ...updates } : r));
    });
    console.log(`✏️ MonthlyReservationsContext: 予約ID ${id} を更新`);
  }, []);

  const removeReservation = useCallback((id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    console.log(`🗑️ MonthlyReservationsContext: 予約ID ${id} を削除`);
  }, []);

  const value = useMemo<MonthlyReservationsContextValue>(
    () => ({
      reservations,
      loading,
      setRange,
      clearReservations,
      refetch,
      addReservations,
      updateReservation,
      removeReservation
    }),
    [reservations, loading, setRange, clearReservations, refetch, addReservations, updateReservation, removeReservation]
  );

  return <MonthlyReservationsContext.Provider value={value}>{children}</MonthlyReservationsContext.Provider>;
};

export function useMonthlyReservations(): MonthlyReservationsContextValue {
  const ctx = useContext(MonthlyReservationsContext);
  if (!ctx) throw new Error('useMonthlyReservations must be used within MonthlyReservationsProvider');
  return ctx;
}
