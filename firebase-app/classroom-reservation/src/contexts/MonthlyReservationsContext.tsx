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

  const load = useCallback(async (start: Date | null, end: Date | null) => {
    if (!start || !end) {
      setReservations([]);
      return;
    }
    try {
      // 要求された範囲（start〜end）だけを取得する（台帳=1日、週/月=それぞれの範囲）
      console.log('🔍 MonthlyReservationsContext.load called:', {
        start: start.toISOString(),
        end: end.toISOString(),
        rangeDays: Math.ceil((end.getTime() - start.getTime()) / 86400000)
      });
      const full = await reservationsService.getReservations(start, end);
      console.log(`📦 Loaded ${full.length} reservations for range ${start.toISOString().slice(0,10)} ~ ${end.toISOString().slice(0,10)}`);
      setReservations(Array.isArray(full) ? full : []);
      return;
    } catch (error) {
      console.error('予約読み込みエラー:', error);
      setReservations([]);
    }
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
    inflightRef.current = load(start, end);
  }, [load]);

  const refetch = useCallback(async () => {
    const { start, end } = rangeRef.current;
    inflightRef.current = load(start, end);
    await inflightRef.current;
  }, [load]);

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


