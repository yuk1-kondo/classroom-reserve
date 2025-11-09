import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';

interface MonthlyReservationsContextValue {
  reservations: Reservation[];
  loading: boolean;
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
  const [loading, setLoading] = useState<boolean>(false);
  const rangeRef = useRef<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const inflightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (start: Date | null, end: Date | null) => {
    if (!start || !end) {
      setReservations([]);
      return;
    }
    
    // リクエスト開始時の範囲を保存（状態更新の条件チェック用）
    const requestedStart = start.getTime();
    const requestedEnd = end.getTime();
    
    try {
      // 要求された範囲（start〜end）だけを取得する（台帳=1日、週/月=それぞれの範囲）
      console.log('🔍 MonthlyReservationsContext.load called:', {
        start: start.toISOString(),
        end: end.toISOString(),
        rangeDays: Math.ceil((end.getTime() - start.getTime()) / 86400000)
      });
      const full = await reservationsService.getReservations(start, end);
      console.log(`📦 Loaded ${full.length} reservations for range ${start.toISOString().slice(0,10)} ~ ${end.toISOString().slice(0,10)}`);
      
      // データ取得完了後、現在のrangeRef.currentと比較
      // 一致する場合のみ状態を更新（最新のリクエストのみ反映）
      const current = rangeRef.current;
      if (current.start?.getTime() === requestedStart && 
          current.end?.getTime() === requestedEnd) {
        setReservations(Array.isArray(full) ? full : []);
      } else {
        console.log('⏭️ 古いリクエストの結果をスキップ（日付が既に変更済み）');
      }
      return;
    } catch (error) {
      // エラー時も同様にチェック
      const current = rangeRef.current;
      if (current.start?.getTime() === requestedStart && 
          current.end?.getTime() === requestedEnd) {
        console.error('予約読み込みエラー:', error);
        setReservations([]);
      } else {
        console.log('⏭️ 古いリクエストのエラーをスキップ（日付が既に変更済み）');
      }
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
    setLoading(true);
    
    // リクエスト開始時の範囲を保存（loading状態管理用）
    const requestStart = start.getTime();
    const requestEnd = end.getTime();
    
    inflightRef.current = (async () => {
      await load(start, end);
      // 読み込み完了後、現在の範囲がまだ同じかチェック
      // 一致する場合のみloadingをfalseにする（最新のリクエストのみ）
      const current = rangeRef.current;
      if (current.start?.getTime() === requestStart && 
          current.end?.getTime() === requestEnd) {
        setLoading(false);
      }
    })();
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
      console.log(`➕ MonthlyReservationsContext: ${toAdd.length}件の予約を追加`);
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
    console.log(`✏️ MonthlyReservationsContext: 予約ID ${id} を更新`);
  }, []);

  // 予約を削除（差分更新）
  const removeReservation = useCallback((id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    console.log(`🗑️ MonthlyReservationsContext: 予約ID ${id} を削除`);
  }, []);

  const value = useMemo<MonthlyReservationsContextValue>(() => ({
    reservations,
    loading,
    setRange,
    refetch,
    addReservations,
    updateReservation,
    removeReservation
  }), [reservations, loading, setRange, refetch, addReservations, updateReservation, removeReservation]);

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


