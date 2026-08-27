import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Reservation } from '../firebase/firestore';
import { parkingReservationsService } from '../firebase/parking';

type LoadResult = 'ok' | 'stale' | 'error';

interface ParkingReservationsContextValue {
  reservations: Reservation[];
  loading: boolean;
  setRange: (start: Date, end: Date) => void;
  refetch: () => Promise<void>;
  addReservations: (newReservations: Reservation[]) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  removeReservation: (id: string) => void;
}

const ParkingReservationsContext = createContext<ParkingReservationsContextValue | undefined>(undefined);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const ParkingReservationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const rangeRef = useRef<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const inflightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (start: Date | null, end: Date | null): Promise<LoadResult> => {
    if (!start || !end) {
      setReservations([]);
      return 'ok';
    }
    const requestedStart = start.getTime();
    const requestedEnd = end.getTime();
    try {
      const full = await parkingReservationsService.getReservations(start, end);
      const current = rangeRef.current;
      if (current.start?.getTime() === requestedStart && current.end?.getTime() === requestedEnd) {
        setReservations(Array.isArray(full) ? full : []);
        return 'ok';
      }
      return 'stale';
    } catch (error) {
      const current = rangeRef.current;
      if (current.start?.getTime() === requestedStart && current.end?.getTime() === requestedEnd) {
        console.error('駐車場予約の読み込みエラー:', error);
        setReservations([]);
        return 'error';
      }
      return 'stale';
    }
  }, []);

  const loadWithRetry = useCallback(async (start: Date, end: Date) => {
    const requestStart = start.getTime();
    const requestEnd = end.getTime();
    const result = await load(start, end);
    if (result !== 'error') return;
    await sleep(400);
    const current = rangeRef.current;
    if (current.start?.getTime() !== requestStart || current.end?.getTime() !== requestEnd) return;
    await load(start, end);
  }, [load]);

  const setRange = useCallback((start: Date, end: Date) => {
    if (!start || !end) return;
    const prev = rangeRef.current;
    if (prev.start?.getTime() === start.getTime() && prev.end?.getTime() === end.getTime()) return;
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
      await loadWithRetry(start, end);
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
      return [...prev, ...toAdd].sort((a, b) => {
        const aTime = (a.startTime as Timestamp).toMillis();
        const bTime = (b.startTime as Timestamp).toMillis();
        return aTime - bTime;
      });
    });
  }, []);

  const updateReservation = useCallback((id: string, updates: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  const removeReservation = useCallback((id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
  }, []);

  const value = useMemo<ParkingReservationsContextValue>(
    () => ({
      reservations,
      loading,
      setRange,
      refetch,
      addReservations,
      updateReservation,
      removeReservation
    }),
    [reservations, loading, setRange, refetch, addReservations, updateReservation, removeReservation]
  );

  return <ParkingReservationsContext.Provider value={value}>{children}</ParkingReservationsContext.Provider>;
};

export function useParkingReservations(): ParkingReservationsContextValue {
  const ctx = useContext(ParkingReservationsContext);
  if (!ctx) throw new Error('useParkingReservations must be used within ParkingReservationsProvider');
  return ctx;
}
