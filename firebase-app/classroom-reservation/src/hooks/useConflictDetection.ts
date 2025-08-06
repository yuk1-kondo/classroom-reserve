// 重複チェック用カスタムフック
import { useState, useCallback } from 'react';
import { reservationsService, periodTimeMap } from '../firebase/firestore';

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

  // 重複チェック関数
  const checkForConflicts = async (
    targetDates: string[], 
    targetPeriods: string[], 
    targetRoomId: string
  ): Promise<{ hasConflict: boolean; message: string; details: string[] }> => {
    console.log('🔍 checkForConflicts呼び出し:', { targetDates, targetPeriods, targetRoomId });
    
    if (!targetRoomId || targetDates.length === 0 || targetPeriods.length === 0) {
      console.log('🔍 チェック条件不足で終了');
      return { hasConflict: false, message: '', details: [] };
    }

    try {
      const conflicts: string[] = [];
      
      for (const date of targetDates) {
        console.log(`🔍 ${date}の重複チェック開始`);
        
        // その日の予約を取得
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0); // 00:00:00から開始
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log(`🔍 検索範囲: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
        
        const existingReservations = await reservationsService.getReservations(startOfDay, endOfDay);
        const roomReservations = existingReservations.filter(r => r.roomId === targetRoomId);
        
        console.log(`🔍 ${date}の全予約:`, existingReservations.length, '件');
        console.log(`🔍 ${date}の対象教室予約:`, roomReservations.length, '件');
        roomReservations.forEach(r => console.log(`  - ${r.periodName} (period: "${r.period}"): ${r.title} [ID: ${r.id}]`));
        
        for (const period of targetPeriods) {
          console.log(`🔍 時限${period}のチェック中...`);
          
          // 既存予約との重複をチェック
          const isConflict = roomReservations.some(reservation => {
            console.log(`  📋 既存予約チェック: "${reservation.period}" vs "${period}"`);
            
            // 既存予約が単一時限の場合
            if (!reservation.period.includes(',')) {
              const conflict = reservation.period === period;
              console.log(`    🔸 単一時限比較: "${reservation.period}" === "${period}" = ${conflict}`);
              if (conflict) console.log(`    ❌ 単一時限重複検出!`);
              return conflict;
            }
            
            // 既存予約が複数時限の場合（カンマ区切り）
            const reservedPeriods = reservation.period.split(',').map(p => p.trim());
            const conflict = reservedPeriods.includes(period);
            console.log(`    🔸 複数時限比較: [${reservedPeriods.join(',')}].includes("${period}") = ${conflict}`);
            if (conflict) console.log(`    ❌ 複数時限重複検出!`);
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
            const dateStr = new Date(date).toLocaleDateString('ja-JP');
            const periodName = periodTimeMap[period as keyof typeof periodTimeMap]?.name || `${period}限`;
            conflicts.push(`${dateStr} ${periodName} (${conflictingReservation?.title || '予約済み'})`);
            console.log(`  ❌ 競合追加: ${dateStr} ${periodName} vs ${conflictingReservation?.periodName}`);
          } else {
            console.log(`  ✅ 時限${period}は利用可能`);
          }
        }
      }
      
      console.log(`🔍 重複チェック完了: 競合数=${conflicts.length}`);
      if (conflicts.length > 0) {
        console.log('❌ 検出された競合:');
        conflicts.forEach((conflict, index) => console.log(`  ${index + 1}. ${conflict}`));
        return {
          hasConflict: true,
          message: `選択した時間帯は既に予約されています`,
          details: conflicts
        };
      }
      
      console.log('✅ 重複なし、予約可能');
      return { hasConflict: false, message: '', details: [] };
    } catch (error) {
      console.error('重複チェックエラー:', error);
      return { hasConflict: false, message: '', details: [] };
    }
  };

  // 重複チェック実行（debounceあり）
  const performConflictCheck = useCallback(async (
    datesToCheck: string[],
    periodsToCheck: string[],
    selectedRoom: string
  ) => {
    if (datesToCheck.length === 0 || periodsToCheck.length === 0 || !selectedRoom) {
      setConflictCheck({ hasConflict: false, conflictMessage: '', conflictDetails: [] });
      return;
    }

    const result = await checkForConflicts(datesToCheck, periodsToCheck, selectedRoom);
    setConflictCheck({
      hasConflict: result.hasConflict,
      conflictMessage: result.message,
      conflictDetails: result.details
    });
  }, []);

  return {
    conflictCheck,
    checkForConflicts,
    performConflictCheck,
    setConflictCheck
  };
};
