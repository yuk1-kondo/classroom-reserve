import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { reservationsService, Reservation } from '../firebase/firestore';
import { db, storageBucketName } from '../firebase/config';
import { loadBundle, namedQuery, getDocs, collection, query as fsQuery, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';

// 簡易ローカル永続キャッシュ（月単位). localStorage を使用
const MONTH_CACHE_KEY = 'monthReservationsCache_v1';
type MonthCache = { [monthId: string]: { at: number; data: Reservation[] } };

function getMonthId(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function readMonthCache(): MonthCache {
  try {
    const raw = localStorage.getItem(MONTH_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeMonthCache(cache: MonthCache) {
  try { localStorage.setItem(MONTH_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

interface MonthlyReservationsValue {
  range: { start: Date; end: Date } | null;
  reservations: Reservation[];
  loading: boolean;
  setRange: (start: Date, end: Date) => void;
  refetch: () => void;
}

const Ctx = createContext<MonthlyReservationsValue | undefined>(undefined);

export const useMonthlyReservations = (): MonthlyReservationsValue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMonthlyReservations must be used within MonthlyReservationsProvider');
  return ctx;
};

interface ProviderProps {
  initialRange?: { start: Date; end: Date } | null;
  children: React.ReactNode;
}

export const MonthlyReservationsProvider: React.FC<ProviderProps> = ({ initialRange = null, children }) => {
  const [range, setRangeState] = useState<{ start: Date; end: Date } | null>(initialRange);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchedRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const setRange = React.useCallback((start: Date, end: Date) => {
    setRangeState({ start, end });
  }, []);

  const fetchRange = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const key = `${start.getTime()}|${end.getTime()}`;
      if (lastFetchedRef.current === key) {
        return; // 重複防止
      }
      lastFetchedRef.current = key;

      // まず localStorage の月キャッシュから表示（stale可）
      const cache = readMonthCache();
      const mid = new Date((start.getTime() + end.getTime()) / 2);
      const monthId = getMonthId(mid);
      const cached = cache[monthId];
      if (cached) {
        setReservations(cached.data);
      }

      // 1) Cloud Storage のバンドルを試す（存在しなければ無視）
      try {
        const y = mid.getFullYear();
        const m = String(mid.getMonth() + 1).padStart(2, '0');
        const bundleUrl = `https://${storageBucketName}/bundles/reservations_${y}-${m}.bundle`;
        const res = await fetch(bundleUrl, { cache: 'force-cache' });
        if (res.ok) {
          await loadBundle(db as any, res.body as any);
          const nq = await namedQuery(db as any, `reservations_${y}-${m}`);
          if (nq) {
            const snap = await getDocs(nq);
            const list = snap.docs.map(d => d.data() as Reservation);
            setReservations(list);
            cache[monthId] = { at: Date.now(), data: list };
            writeMonthCache(cache);
            // 続けてオンラインで最新を取得して反映（SWR）
          }
        }
      } catch {}

      // 1b) JSONフォールバック（Functions未導入時用）
      try {
        const y = mid.getFullYear();
        const m = String(mid.getMonth() + 1).padStart(2, '0');
        const jsonUrl = `https://${storageBucketName}/bundles/reservations_${y}-${m}.json`;
        const r2 = await fetch(jsonUrl, { cache: 'force-cache' });
        if (r2.ok) {
          const data = await r2.json();
          const list = Array.isArray(data?.docs) ? (data.docs as Reservation[]) : [];
          if (list.length > 0) {
            setReservations(list);
            cache[monthId] = { at: Date.now(), data: list };
            writeMonthCache(cache);
            // 続けてオンラインで最新を取得して反映（SWR）
          }
        }
      } catch {}

      // 2) フォールバック: 既存APIで取得
      const list2 = await reservationsService.getReservations(start, end);
      setReservations(list2);
      cache[monthId] = { at: Date.now(), data: list2 };
      writeMonthCache(cache);
    } finally {
      setLoading(false);
    }
  };

  const refetch = React.useCallback(() => {
    if (range) fetchRange(range.start, range.end);
  }, [range]);

  useEffect(() => {
    if (range) fetchRange(range.start, range.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.start?.getTime?.(), range?.end?.getTime?.()]);

  // Realtime: 可視範囲に onSnapshot を張り、変更を即反映
  useEffect(() => {
    // 既存の購読を解除
    if (unsubRef.current) {
      try { unsubRef.current(); } catch {}
      unsubRef.current = null;
    }
    if (!range) return;
    const q = fsQuery(
      collection(db as any, 'reservations'),
      where('startTime', '>=', Timestamp.fromDate(range.start)),
      where('startTime', '<=', Timestamp.fromDate(range.end)),
      orderBy('startTime', 'asc')
    ) as any;
    const unsub = onSnapshot(q, (snap: any) => {
      const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Reservation[];
      setReservations(list);
      // 月キャッシュも更新（SWR整合）
      try {
        const monthId = getMonthId(new Date((range.start.getTime() + range.end.getTime()) / 2));
        const cache = readMonthCache();
        cache[monthId] = { at: Date.now(), data: list };
        writeMonthCache(cache);
      } catch {}
    });
    unsubRef.current = unsub;
    return () => { try { unsub(); } catch {} };
  }, [range?.start?.getTime?.(), range?.end?.getTime?.()]);

  const value = useMemo<MonthlyReservationsValue>(() => ({
    range,
    reservations,
    loading,
    setRange,
    refetch
  }), [range, reservations, loading, setRange, refetch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};



