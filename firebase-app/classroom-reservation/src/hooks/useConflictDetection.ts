// 重複チェック用カスタムフック
import { useState, useCallback, useRef } from 'react';
import { reservationsService } from '../firebase/firestore';
import { dayRange } from '../utils/dateRange';
import { displayLabel } from '../utils/periodLabel';

const debug = (...args: any[]) => { if (process.env.NODE_ENV !== 'production') console.log(...args); };

export interface ConflictCheckState {
  hasConflict: boolean;
  conflictMessage: string;
  conflictDetails: string[];
}

export const useConflictDetection = () => {
  const [conflictCheck, setConflictCheck] = useState<ConflictCheckState>({
    hasConflict: false,
    conflictMessage: '',
    conflictDetails: []
  });

  // debounce 用タイマー
  const timerRef = useRef<any>(null);
  // 直近の取得結果を短時間キャッシュ（429/スパイク対策）
  const cacheRef = useRef<Map<string, { ts: number; periodsByRoom: Record<string, string[]> }>>(new Map());

  // 指定日の予約を取得して、roomId→予約済みperiod配列 のマップを返す（再試行/キャッシュ付き）
  const loadDayRoomPeriods = useCallback(async (date: string): Promise<Record<string, string[]>> => {
    const cacheKey = `day:${date}`;
    const now = Date.now();
    const cached = cacheRef.current.get(cacheKey);
    if (cached && now - cached.ts < 5000) {
      return cached.periodsByRoom;
    }

    const { start: startOfDay, end: endOfDay } = dayRange(date);

    const tryFetch = async (): Promise<Record<string, string[]>> => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const list = await reservationsService.getReservations(startOfDay, endOfDay);
          const map: Record<string, string[]> = {};
          for (const r of list) {
            const periods = r.period.includes(',') ? r.period.split(',').map(p => p.trim()) : [r.period];
            if (!map[r.roomId]) map[r.roomId] = [];
            map[r.roomId].push(...periods);
          }
          return map;
        } catch (e) {
          lastErr = e;
          await new Promise(res => setTimeout(res, 400 * Math.pow(2, attempt)));
        }
      }
      const errorMessage = lastErr && typeof lastErr === 'object' && 'message' in lastErr 
        ? String(lastErr.message) 
        : '予約データの取得に失敗しました';
      throw new Error(errorMessage);
    };

    const periodsByRoom = await tryFetch();
    cacheRef.current.set(cacheKey, { ts: now, periodsByRoom });
    return periodsByRoom;
  }, []);

  // 重複チェック関数（安定化のため useCallback 化）
  const checkForConflicts = useCallback(async (
    targetDates: string[], 
    targetPeriods: string[], 
    targetRoomId: string,
    currentUserId?: string
  ): Promise<{ hasConflict: boolean; message: string; details: string[] }> => {
    debug('🔍 checkForConflicts呼び出し:', { targetDates, targetPeriods, targetRoomId, currentUserId });
    
    if (!targetRoomId || targetDates.length === 0 || targetPeriods.length === 0) {
      debug('🔍 チェック条件不足で終了');
      return { hasConflict: false, message: '', details: [] };
    }

    try {
      const conflicts: string[] = [];
      
      for (const date of targetDates) {
        debug(`🔍 ${date}の重複チェック開始`);
        
        // その日の予約（キャッシュ/リトライ付き）
        const periodsByRoom = await loadDayRoomPeriods(date);
        const reservedPeriodsForRoom = periodsByRoom[targetRoomId] || [];
        debug(`🔍 ${date}の対象教室予約:`, reservedPeriodsForRoom.join(','));
        
        for (const period of targetPeriods) {
          debug(`🔍 時限${period}のチェック中...`);
          
          // 既存予約との重複をチェック
          const isConflict = reservedPeriodsForRoom.includes(period);
          
          if (isConflict) {
            const dateStr = new Date(date).toLocaleDateString('ja-JP');
            const periodName = displayLabel(period);
            conflicts.push(`${dateStr} ${periodName} - 既に予約があります`);
            debug(`  ❌ 競合: ${dateStr} ${periodName}`);
          } else {
            debug(`  ✅ 時限${period}は利用可能`);
          }
        }
      }
      
      debug(`🔍 重複チェック完了: 競合数=${conflicts.length}`);
      if (conflicts.length > 0) {
        debug('❌ 検出された競合:');
        conflicts.forEach((conflict, index) => debug(`  ${index + 1}. ${conflict}`));
        return {
          hasConflict: true,
          message: '選択した時間帯は既に予約があります。',
          details: conflicts
        };
      }
      
      debug('✅ 重複なし、予約可能');
      return { hasConflict: false, message: '', details: [] };
    } catch (error) {
      console.error('重複チェックエラー:', error);
      return { hasConflict: false, message: '', details: [] };
    }
  }, [loadDayRoomPeriods]);

  // 重複チェック実行（debounceあり）
  const performConflictCheck = useCallback(async (
    datesToCheck: string[],
    periodsToCheck: string[],
    selectedRoom: string,
    currentUserId?: string
  ) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      if (!selectedRoom || datesToCheck.length === 0 || periodsToCheck.length === 0) {
        debug('🔍 条件不足のため重複チェックスキップ');
        setConflictCheck({ hasConflict: false, conflictMessage: '', conflictDetails: [] });
        return;
      }

      const result = await checkForConflicts(datesToCheck, periodsToCheck, selectedRoom, currentUserId);
      setConflictCheck({
        hasConflict: result.hasConflict,
        conflictMessage: result.message,
        conflictDetails: result.details
      });
    }, 500); // 500ms debounce（連打/入力中のスパイク抑制）
  }, [checkForConflicts]);

  // 競合状態リセット用
  const resetConflict = useCallback(() => {
    setConflictCheck({ hasConflict: false, conflictMessage: '', conflictDetails: [] });
  }, []);

  return {
    conflictCheck,
    performConflictCheck,
    checkForConflicts,
    resetConflict
  };
};
