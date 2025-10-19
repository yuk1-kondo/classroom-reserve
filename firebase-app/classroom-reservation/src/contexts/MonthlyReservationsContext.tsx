import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { storageBucketName } from '../firebase/config';
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

  // セッション内バンドルキャッシュ（月ID→配列）
  const bundleCacheRef = useRef<Map<string, Reservation[]>>(new Map());

  const tryParseAdminTimestamp = (maybe: any): Timestamp | null => {
    if (!maybe) return null;
    // Admin Timestamp -> {_seconds,_nanoseconds} or {seconds,nanoseconds}
    const s = Number(maybe._seconds ?? maybe.seconds);
    const ns = Number(maybe._nanoseconds ?? maybe.nanoseconds);
    if (Number.isFinite(s)) {
      const ms = s * 1000 + Math.round((ns || 0) / 1e6);
      return Timestamp.fromMillis(ms);
    }
    return null;
  };

  const normalizeBundleDoc = (raw: any): Reservation => {
    const st = tryParseAdminTimestamp((raw as any).startTime) || (raw as any).startTime;
    const et = tryParseAdminTimestamp((raw as any).endTime) || (raw as any).endTime;
    return {
      id: String((raw as any).id || ''),
      roomId: String((raw as any).roomId || ''),
      roomName: String((raw as any).roomName || ''),
      title: String((raw as any).title || ''),
      reservationName: String((raw as any).reservationName || ''),
      startTime: st as any,
      endTime: et as any,
      period: String((raw as any).period || ''),
      periodName: String((raw as any).periodName || ''),
      createdAt: tryParseAdminTimestamp((raw as any).createdAt) || undefined,
      createdBy: (raw as any).createdBy || undefined
    } as Reservation;
  };

  const fetchMonthlyBundle = useCallback(async (monthId: string): Promise<{ reservations: Reservation[]; generatedAt: number | null }> => {
    try {
      // メモリキャッシュチェック
      if (bundleCacheRef.current.has(monthId)) {
        return { reservations: bundleCacheRef.current.get(monthId)!, generatedAt: null };
      }
      const bucket = storageBucketName;
      if (!bucket) return { reservations: [], generatedAt: null };
      
      const encodedPath = encodeURIComponent(`bundles/reservations_${monthId}.json`);
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
      
      // ブラウザキャッシュを最大限活用（認証なし、公開URL）
      const res = await fetch(url, { 
        cache: 'force-cache' // ブラウザキャッシュから取得、なければネットワーク
      });
      if (!res.ok) return { reservations: [], generatedAt: null };
      const json = await res.json();
      const docs = Array.isArray(json?.docs) ? json.docs : [];
      const list = docs.map(normalizeBundleDoc);
      const generatedAt = typeof json?.generatedAt === 'number' ? json.generatedAt : null;
      
      // メモリキャッシュに保存
      bundleCacheRef.current.set(monthId, list);
      return { reservations: list, generatedAt };
    } catch {
      return { reservations: [], generatedAt: null };
    }
  }, []);

  const load = useCallback(async (start: Date | null, end: Date | null) => {
    if (!start || !end) {
      setReservations([]);
      return;
    }
    try {
      // まず月次バンドルを試す（開始・終了で最大2ヶ月）
      const monthId = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const monthId2 = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
      
      let combined: Reservation[] = [];
      let oldestGeneratedAt: number | null = null;
      
      const a = await fetchMonthlyBundle(monthId);
      if (a.reservations.length > 0) {
        combined = a.reservations;
        oldestGeneratedAt = a.generatedAt;
      }
      if (monthId2 !== monthId) {
        const b = await fetchMonthlyBundle(monthId2);
        if (b.reservations.length > 0) {
          combined = combined.concat(b.reservations);
          if (b.generatedAt && (!oldestGeneratedAt || b.generatedAt < oldestGeneratedAt)) {
            oldestGeneratedAt = b.generatedAt;
          }
        }
      }
      
      if (combined.length > 0 && oldestGeneratedAt) {
        // 差分予約を取得（バンドル生成後に作成された予約）
        const { Timestamp, collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase/config');
        
        // シンプルなクエリ（createdAtのみ）: startTimeはフロント側でフィルタ
        const diffQuery = query(
          collection(db, 'reservations'),
          where('createdAt', '>', Timestamp.fromMillis(oldestGeneratedAt)),
          orderBy('createdAt', 'asc')
        );
        
        const diffSnap = await getDocs(diffQuery);
        const allDiffReservations = diffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
        
        // フロント側でstartTimeでフィルタ
        const diffReservations = allDiffReservations.filter(r => {
          const st: Date = (r.startTime as any)?.toDate?.() || new Date(r.startTime as any);
          return st >= start && st <= end;
        });
        
        console.log(`📦 バンドル: ${combined.length}件, 🆕 差分（全体）: ${allDiffReservations.length}件, 差分（範囲内）: ${diffReservations.length}件`);
        
        // マージ（差分で既存を上書き）
        const mergedMap = new Map<string, Reservation>();
        combined.forEach(r => mergedMap.set(r.id!, r));
        diffReservations.forEach(r => mergedMap.set(r.id!, r));
        
        const merged = Array.from(mergedMap.values());
        const filtered = merged.filter(r => {
          const st: Date = (r.startTime as any)?.toDate?.() || new Date(r.startTime as any);
          return st >= start && st <= end;
        });
        
        setReservations(filtered);
        return;
      }

      // フォールバック: 直接Firestore
      const list = await reservationsService.getReservations(start, end);
      setReservations(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('予約読み込みエラー:', error);
      setReservations([]);
    }
  }, [fetchMonthlyBundle]);

  const setRange = useCallback((start: Date, end: Date) => {
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


