import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { reservationsService, roomsService, Reservation, Room } from '../firebase/firestore';
import { dayRange } from '../utils/dateRange';
import { useAuth } from '../hooks/useAuth';
import { useScienceGroupMembership } from '../hooks/useScienceGroupMembership';
import { filterScienceOnlyRoomsForViewer } from '../utils/roomAccess';

interface ReservationDataContextValue {
  rooms: Room[];
  reservations: Reservation[];
  addReservations: (newReservations: Reservation[]) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  removeReservation: (id: string) => void;
  refetch: () => Promise<void>;
}

const ReservationDataContext = createContext<ReservationDataContextValue | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
  date: string; // YYYY-MM-DD
}

export const ReservationDataProvider: React.FC<ProviderProps> = ({ children, date }) => {
  const { currentUser, isAdmin } = useAuth();
  const { isScienceMember } = useScienceGroupMembership(currentUser?.uid);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const loadRooms = useCallback(async () => {
    try {
      const list = await roomsService.getAllRooms();
      const raw = Array.isArray(list) ? list : [];
      setRooms(filterScienceOnlyRoomsForViewer(raw, { isAdmin, isScienceMember }));
    } catch {
      setRooms([]);
    }
  }, [isAdmin, isScienceMember]);

  const loadDay = useCallback(async (dateStr: string) => {
    try {
      const { start, end } = dayRange(dateStr);
      const list = await reservationsService.getReservations(start, end);
      setReservations(Array.isArray(list) ? list : []);
    } catch {
      setReservations([]);
    }
  }, []);

  // 予約を追加（差分更新）
  const addReservations = useCallback((newReservations: Reservation[]) => {
    setReservations(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = newReservations.filter(r => !existingIds.has(r.id));
      console.log(`➕ ReservationDataContext: ${toAdd.length}件の予約を追加`);
      return [...prev, ...toAdd].sort((a, b) => {
        const aTime = (a.startTime as any).toMillis?.() || (a.startTime as any).getTime?.() || 0;
        const bTime = (b.startTime as any).toMillis?.() || (b.startTime as any).getTime?.() || 0;
        return aTime - bTime;
      });
    });
  }, []);

  // 予約を更新（差分更新）
  const updateReservation = useCallback((id: string, updates: Partial<Reservation>) => {
    setReservations(prev => {
      return prev.map(r => r.id === id ? { ...r, ...updates } : r);
    });
    console.log(`✏️ ReservationDataContext: 予約ID ${id} を更新`);
  }, []);

  // 予約を削除（差分更新）
  const removeReservation = useCallback((id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    console.log(`🗑️ ReservationDataContext: 予約ID ${id} を削除`);
  }, []);

  // 再取得
  const refetch = useCallback(async () => {
    if (date) await loadDay(date);
  }, [date, loadDay]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (date) loadDay(date);
  }, [date, loadDay]);

  const value = useMemo<ReservationDataContextValue>(() => ({ 
    rooms, 
    reservations, 
    addReservations, 
    updateReservation, 
    removeReservation,
    refetch
  }), [rooms, reservations, addReservations, updateReservation, removeReservation, refetch]);

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
