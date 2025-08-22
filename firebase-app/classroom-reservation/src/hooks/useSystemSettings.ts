// システム設定を取得し、予約の先日付制限を提供するフック
import { useEffect, useMemo, useState } from 'react';
import { systemSettingsService, calcMaxDateFromMonths } from '../firebase/settings';

export const useSystemSettings = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitMonths, setLimitMonths] = useState<number>(3); // 既定3ヶ月
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const s = await systemSettingsService.get();
        if (!mounted) return;
        const months = s?.reservationLimitMonths ?? 3;
        setLimitMonths(months);
        if (s?.reservationMaxTimestamp) {
          setMaxDate(s.reservationMaxTimestamp.toDate());
        } else {
          setMaxDate(calcMaxDateFromMonths(months));
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || '設定の取得に失敗しました');
        // 取得失敗時も既定値で続行
        setLimitMonths(3);
        setMaxDate(calcMaxDateFromMonths(3));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const maxDateStr = useMemo(() => {
    if (!maxDate) return undefined;
    const y = maxDate.getFullYear();
    const m = String(maxDate.getMonth() + 1).padStart(2, '0');
    const d = String(maxDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [maxDate]);

  return { loading, error, limitMonths, maxDate, maxDateStr } as const;
};
