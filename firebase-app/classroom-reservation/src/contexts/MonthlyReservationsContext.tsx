import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { logger } from '../utils/logger';

interface MonthlyReservationsContextValue {
  reservations: Reservation[];
  setRange: (start: Date, end: Date) => void;
  refetch: () => Promise<void>;
  addReservations: (newReservations: Reservation[]) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  removeReservation: (id: string) => void;
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
      logger.debug('🔍 MonthlyReservationsContext.load called:', {
        start: start.toISOString(),
        end: end.toISOString(),
        rangeDays: Math.ceil((end.getTime() - start.getTime()) / 86400000)
      });
      const full = await reservationsService.getReservations(start, end);
      logger.debug(`📦 Loaded ${full.length} reservations for range ${start.toISOString().slice(0,10)} ~ ${end.toISOString().slice(0,10)}`);
      setReservations(Array.isArray(full) ? full : []);
      return;
    } catch (error) {
      logger.error('予約読み込みエラー:', error);
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

  // 予約を追加（差分更新）
  const addReservations = useCallback((newReservations: Reservation[]) => {
    setReservations(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = newReservations.filter(r => !existingIds.has(r.id));
      logger.debug(`➕ MonthlyReservationsContext: ${toAdd.length}件の予約を追加`);
      return [...prev, ...toAdd].sort((a, b) => {
        const aTime = (a.startTime as Timestamp).toMillis();
        const bTime = (b.startTime as Timestamp).toMillis();
        return aTime - bTime;
      });
    });
  }, []);

  // 予約を更新（差分更新）
  const updateReservation = useCallback((id: string, updates: Partial<Reservation>) => {
    setReservations(prev => {
      return prev.map(r => r.id === id ? { ...r, ...updates } : r);
    });
    logger.debug(`✏️ MonthlyReservationsContext: 予約ID ${id} を更新`);
  }, []);

  // 予約を削除（差分更新）
  const removeReservation = useCallback((id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    logger.debug(`🗑️ MonthlyReservationsContext: 予約ID ${id} を削除`);
  }, []);

  const value = useMemo<MonthlyReservationsContextValue>(() => ({
    reservations,
    setRange,
    refetch,
    addReservations,
    updateReservation,
    removeReservation
  }), [reservations, setRange, refetch, addReservations, updateReservation, removeReservation]);

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


