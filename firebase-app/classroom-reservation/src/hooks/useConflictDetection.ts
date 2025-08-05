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
    if (!targetRoomId || targetDates.length === 0 || targetPeriods.length === 0) {
      return { hasConflict: false, message: '', details: [] };
    }

    try {
      const conflicts: string[] = [];
      
      for (const date of targetDates) {
        // その日の予約を取得
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingReservations = await reservationsService.getReservations(startOfDay, endOfDay);
        const roomReservations = existingReservations.filter(r => r.roomId === targetRoomId);
        
        for (const period of targetPeriods) {
          // 既存予約との重複をチェック
          const isConflict = roomReservations.some(reservation => {
            // 単一時限の場合
            if (!reservation.period.includes(',')) {
              return reservation.period === period;
            }
            
            // 複数時限の場合（カンマ区切り）
            const reservedPeriods = reservation.period.split(',');
            return reservedPeriods.includes(period);
          });
          
          if (isConflict) {
            const conflictingReservation = roomReservations.find(r => 
              r.period === period || r.period.split(',').includes(period)
            );
            const dateStr = new Date(date).toLocaleDateString('ja-JP');
            const periodName = periodTimeMap[period as keyof typeof periodTimeMap]?.name || `${period}限`;
            conflicts.push(`${dateStr} ${periodName} (${conflictingReservation?.title || '予約済み'})`);
          }
        }
      }
      
      if (conflicts.length > 0) {
        return {
          hasConflict: true,
          message: `選択した時間帯は既に予約されています`,
          details: conflicts
        };
      }
      
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
