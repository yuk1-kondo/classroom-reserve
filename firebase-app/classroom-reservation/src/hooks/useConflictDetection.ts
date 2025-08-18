// 重複チェック用カスタムフック
import { useState, useCallback, useRef } from 'react';
import { reservationsService } from '../firebase/firestore';
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
        
        // その日の予約を取得
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0); // 00:00:00から開始
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        debug(`🔍 検索範囲: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
        
        const existingReservations = await reservationsService.getReservations(startOfDay, endOfDay);
        const roomReservations = existingReservations.filter(r => r.roomId === targetRoomId);
        
        debug(`🔍 ${date}の全予約:`, existingReservations.length, '件');
        debug(`🔍 ${date}の対象教室予約:`, roomReservations.length, '件');
        roomReservations.forEach(r => debug(`  - ${r.periodName} (period: "${r.period}"): ${r.title} [ID: ${r.id}]`));
        
        for (const period of targetPeriods) {
          debug(`🔍 時限${period}のチェック中...`);
          
          // 既存予約との重複をチェック
          const isConflict = roomReservations.some(reservation => {
            debug(`  📋 既存予約チェック: "${reservation.period}" vs "${period}"`);
            
            // 既存予約が単一時限の場合
            if (!reservation.period.includes(',')) {
              const conflict = reservation.period === period;
              debug(`    🔸 単一時限比較: "${reservation.period}" === "${period}" = ${conflict}`);
              if (conflict) debug(`    ❌ 単一時限重複検出!`);
              return conflict;
            }
            
            // 既存予約が複数時限の場合（カンマ区切り）
            const reservedPeriods = reservation.period.split(',').map(p => p.trim());
            const conflict = reservedPeriods.includes(period);
            debug(`    🔸 複数時限比較: [${reservedPeriods.join(',')}].includes("${period}") = ${conflict}`);
            if (conflict) debug(`    ❌ 複数時限重複検出!`);
            return conflict;
          });
          
          if (isConflict) {
            const conflictingReservation = roomReservations.find(r => {
              if (!r.period.includes(',')) {
                return r.period === period;
              } else {
                const reservedPeriods = r.period.split(',').map(p => p.trim());
                return reservedPeriods.includes(period);
              }
            });
            
            // ユーザーIDチェック: 同じユーザーかどうか確認
            if (conflictingReservation && currentUserId && conflictingReservation.createdBy === currentUserId) {
              const dateStr = new Date(date).toLocaleDateString('ja-JP');
              const periodName = displayLabel(period);
              conflicts.push(`${dateStr} ${periodName} - 既に同じ時間帯を予約済みです`);
              debug(`  ❌ 同一ユーザー重複検出: ${dateStr} ${periodName} (ユーザー: ${currentUserId})`);
            } else if (conflictingReservation) {
              const dateStr = new Date(date).toLocaleDateString('ja-JP');
              const periodName = displayLabel(period);
              conflicts.push(`${dateStr} ${periodName} (${conflictingReservation?.title || '他のユーザーが予約済み'})`);
              debug(`  ❌ 他ユーザー競合: ${dateStr} ${periodName} vs ${conflictingReservation?.periodName}`);
            }
          } else {
            debug(`  ✅ 時限${period}は利用可能`);
          }
        }
      }
      
      debug(`🔍 重複チェック完了: 競合数=${conflicts.length}`);
      if (conflicts.length > 0) {
        debug('❌ 検出された競合:');
        conflicts.forEach((conflict, index) => debug(`  ${index + 1}. ${conflict}`));
        
        // 同一ユーザー重複と他ユーザー競合を区別
        const hasSameUserConflict = conflicts.some(c => c.includes('既に同じ時間帯を予約済みです'));
        const message = hasSameUserConflict 
          ? '既に同じ時間帯を予約済みです。予約を変更または削除してください。'
          : '選択した時間帯は他のユーザーにより予約されています。';
        
        return {
          hasConflict: true,
          message,
          details: conflicts
        };
      }
      
      debug('✅ 重複なし、予約可能');
      return { hasConflict: false, message: '', details: [] };
    } catch (error) {
      console.error('重複チェックエラー:', error);
      return { hasConflict: false, message: '', details: [] };
    }
  }, []);

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
    }, 300); // 300ms debounce
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
