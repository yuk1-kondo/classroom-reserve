import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { roomsService, reservationsService, Room, Reservation } from '../firebase/firestore';
import { dayRange } from '../utils/dateRange';

interface ReservationDataContextValue {
  date?: string;
  rooms: Room[];
  reservations: Reservation[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const ReservationDataContext = createContext<ReservationDataContextValue | undefined>(undefined);

interface ProviderProps {
  date?: string; // YYYY-MM-DD
  children: React.ReactNode;
}

export const ReservationDataProvider: React.FC<ProviderProps> = ({ date, children }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = React.useCallback(async () => {
    const list = await roomsService.getAllRooms();
    setRooms(list);
  }, []);

  const loadReservations = React.useCallback(async (d?: string) => {
    if (!d) {
      setReservations([]);
      return;
    }
    const { start, end } = dayRange(d);
    const list = await reservationsService.getReservations(start, end);
    setReservations(list);
  }, []);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadRooms(), loadReservations(date)]);
    } catch (e: any) {
      setError(e?.message || '読み取りに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [date, loadRooms, loadReservations]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const value = useMemo<ReservationDataContextValue>(() => ({
    date,
    rooms,
    reservations,
    loading,
    error,
    reload
  }), [date, rooms, reservations, loading, error, reload]);

  return (
    <ReservationDataContext.Provider value={value}>
      {children}
    </ReservationDataContext.Provider>
  );
};

export const useReservationDataContext = (): ReservationDataContextValue => {
  const ctx = useContext(ReservationDataContext);
  if (!ctx) {
    throw new Error('useReservationDataContext must be used within ReservationDataProvider');
  }
  return ctx;
};



