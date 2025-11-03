import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { reservationsService, roomsService, Reservation, Room } from '../firebase/firestore';
import { dayRange } from '../utils/dateRange';

interface ReservationDataContextValue {
  rooms: Room[];
  reservations: Reservation[];
}

const ReservationDataContext = createContext<ReservationDataContextValue | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
  date: string; // YYYY-MM-DD
}

export const ReservationDataProvider: React.FC<ProviderProps> = ({ children, date }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const loadRooms = useCallback(async () => {
    try {
      const list = await roomsService.getAllRooms();
      setRooms(Array.isArray(list) ? list : []);
    } catch {
      setRooms([]);
    }
  }, []);

  const loadDay = useCallback(async (dateStr: string) => {
    try {
      const { start, end } = dayRange(dateStr);
      const list = await reservationsService.getReservations(start, end);
      setReservations(Array.isArray(list) ? list : []);
    } catch {
      setReservations([]);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (date) loadDay(date);
  }, [date, loadDay]);

  const value = useMemo<ReservationDataContextValue>(() => ({ rooms, reservations }), [rooms, reservations]);

  return (
    <ReservationDataContext.Provider value={value}>
      {children}
    </ReservationDataContext.Provider>
  );
};

export function useReservationDataContext(): ReservationDataContextValue {
  const ctx = useContext(ReservationDataContext);
  if (!ctx) throw new Error('useReservationDataContext must be used within ReservationDataProvider');
  return ctx;
}
