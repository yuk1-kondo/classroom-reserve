// 時限範囲選択コンポーネント
import React from 'react';
import { PeriodRangeState } from '../hooks/useReservationForm';
import { periodTimeMap, Reservation, PERIOD_ORDER, ReservationSlot } from '../firebase/firestore';

interface PeriodRangeSelectorProps {
  periodRange: PeriodRangeState;
  setPeriodRange: React.Dispatch<React.SetStateAction<PeriodRangeState>>;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
  reservations?: Reservation[];
  slots?: ReservationSlot[];
  selectedRoom?: string;
  selectedDate?: string;
}

export const PeriodRangeSelector: React.FC<PeriodRangeSelectorProps> = ({
  periodRange,
  setPeriodRange,
  selectedPeriod,
  onPeriodChange,
  loading,
  reservations = [],
  slots = [],
  selectedRoom,
  selectedDate
}) => {
  // 時限フォーマット
  const formatPeriod = (period: string): string => {
    const timeInfo = periodTimeMap[period as keyof typeof periodTimeMap];
    if (!timeInfo) return period;
    if (period === '0') {
      return `${timeInfo.name} (- ${timeInfo.end})`;
    }
    if (period === 'after') {
      return `${timeInfo.name} (${timeInfo.start} -)`;
    }
    return `${timeInfo.name} (${timeInfo.start} - ${timeInfo.end})`;
  };

  // 指定時限が予約済みかチェック（スロット参照は負荷増のため行わない）
  const isPeriodReserved = (period: string): boolean => {
    if (!selectedRoom || !selectedDate) {
      console.log('🔍 isPeriodReserved: selectedRoom または selectedDate が未設定', { selectedRoom, selectedDate });
      return false;
    }
    
    console.log('🔍 isPeriodReserved チェック開始:', { 
      period, 
      selectedRoom, 
      selectedDate, 
      reservationsCount: reservations.length 
    });
    
  const isReserved = reservations.some(reservation => {
      console.log('🔍 予約チェック:', {
        reservationId: reservation.id,
        reservationRoomId: reservation.roomId,
        reservationPeriod: reservation.period,
        reservationTitle: reservation.title
      });
      
      if (reservation.roomId !== selectedRoom) {
        console.log('  → 教室が異なる');
        return false;
      }
      
      // 予約日をチェック
      const reservationDate = reservation.startTime.toDate().toDateString();
      const checkDate = new Date(selectedDate).toDateString();
      console.log('🔍 日付チェック:', { reservationDate, checkDate });
      
      if (reservationDate !== checkDate) {
        console.log('  → 日付が異なる');
        return false;
      }
      
      // 時限をチェック
      if (!reservation.period.includes(',')) {
        const match = reservation.period === period;
        console.log('🔍 単一時限チェック:', { reservationPeriod: reservation.period, targetPeriod: period, match });
        return match;
      } else {
        const reservedPeriods = reservation.period.split(',').map(p => p.trim());
        const match = reservedPeriods.includes(period);
        console.log('🔍 複数時限チェック:', { reservedPeriods, targetPeriod: period, match });
        return match;
      }
    });
    
    if (isReserved) {
      console.log('🔍 isPeriodReserved 結果: 予約で占有', { period, isReserved });
      return true;
    }
    // スロット読み取りは行わず、予約ベースのみで判定（429対策）
    return false;
  };

  return (
    <div className="form-group">
      <label>時限:</label>
      {/* 4限の後に昼休みを固定順序で表示 */}
      {/* 時限範囲選択 */}
      <div className="period-range-selector">
        <div className="period-toggle">
          <label>
            <input
              type="radio"
              name="periodMode"
              checked={!periodRange.isRangeMode}
              onChange={() => setPeriodRange(prev => ({ ...prev, isRangeMode: false }))}
            />
            単一時限
          </label>
          <label>
            <input
              type="radio"
              name="periodMode"
              checked={periodRange.isRangeMode}
              onChange={() => setPeriodRange(prev => ({ ...prev, isRangeMode: true }))}
            />
            複数時限
          </label>
        </div>

        {!periodRange.isRangeMode ? (
          <select 
            value={selectedPeriod} 
            onChange={(e) => onPeriodChange(e.target.value)}
            disabled={loading}
            aria-label="時限を選択"
          >
            <option value="">時限を選択</option>
            {PERIOD_ORDER.map(key => {
              const isReserved = isPeriodReserved(key);
              const optionClass = isReserved ? 'period-option reserved' : 'period-option';
              return (
                <option 
                  key={key} 
                  value={key} 
                  disabled={isReserved}
                  className={optionClass}
                >
                  {formatPeriod(key)}{isReserved ? ' (予約済み)' : ''}
                </option>
              );
            })}
          </select>
        ) : (
          <div className="period-inputs">
            <div className="period-input-group">
              <label>開始時限:</label>
              <select
                value={periodRange.startPeriod}
                onChange={(e) => setPeriodRange(prev => ({ ...prev, startPeriod: e.target.value }))}
                disabled={loading}
                aria-label="開始時限を選択"
              >
                <option value="">選択</option>
                {PERIOD_ORDER.map(key => {
                  const isReserved = isPeriodReserved(key);
                  const optionClass = isReserved ? 'period-option reserved' : 'period-option';
                  return (
                    <option 
                      key={key} 
                      value={key}
                      disabled={isReserved}
                      className={optionClass}
                    >
                      {formatPeriod(key)}{isReserved ? ' (予約済み)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="period-input-group">
              <label>終了時限:</label>
              <select
                value={periodRange.endPeriod}
                onChange={(e) => setPeriodRange(prev => ({ ...prev, endPeriod: e.target.value }))}
                disabled={loading}
                aria-label="終了時限を選択"
              >
                <option value="">選択</option>
                {PERIOD_ORDER.map(key => {
                  const isReserved = isPeriodReserved(key);
                  const optionClass = isReserved ? 'period-option reserved' : 'period-option';
                  return (
                    <option 
                      key={key} 
                      value={key}
                      disabled={isReserved}
                      className={optionClass}
                    >
                      {formatPeriod(key)}{isReserved ? ' (予約済み)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
