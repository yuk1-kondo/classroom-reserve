// 時限範囲選択コンポーネント
import React from 'react';
import { PeriodRangeState } from '../hooks/useReservationForm';
import { Reservation, PERIOD_ORDER, createDateTimeFromPeriod } from '../firebase/firestore';
import { displayLabel } from '../utils/periodLabel';

interface PeriodRangeSelectorProps {
  periodRange: PeriodRangeState;
  setPeriodRange: React.Dispatch<React.SetStateAction<PeriodRangeState>>;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
  reservations?: Reservation[];
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
  selectedRoom,
  selectedDate
}) => {
  // 時限フォーマット（曜日に応じた時間帯を反映）
  const formatPeriod = (period: string): string => {
    const name = displayLabel(String(period));
    const ds = selectedDate || '';
    const dt = createDateTimeFromPeriod(ds, period);
    if (!dt) return name;
    const toHM = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    if (period === '0') {
      return `${name} (- ${toHM(dt.end)})`;
    }
    if (period === 'after') {
      return `${name} (${toHM(dt.start)} -)`;
    }
    return `${name} (${toHM(dt.start)} - ${toHM(dt.end)})`;
  };

  // 指定時限が予約済みかチェック（スロット参照は負荷増のため行わない）
  const isPeriodReserved = (period: string): boolean => {
    if (!selectedRoom || !selectedDate) {
      return false;
    }
    
  const isReserved = reservations.some(reservation => {
      if (reservation.roomId !== selectedRoom) {
        return false;
      }
      
      // 予約日をチェック
      const reservationDate = reservation.startTime.toDate().toDateString();
      const checkDate = new Date(selectedDate).toDateString();
      
      if (reservationDate !== checkDate) {
        return false;
      }
      
      // 時限をチェック
      if (!reservation.period.includes(',')) {
        return reservation.period === period;
      } else {
        const reservedPeriods = reservation.period.split(',').map(p => p.trim());
        return reservedPeriods.includes(period);
      }
    });
    
    return isReserved;
  };

  // 曜日により7限を隠す（Mon/Wed以外）
  const availableOrder = React.useMemo(() => {
    if (!selectedDate) return PERIOD_ORDER;
    try {
      const d = new Date(selectedDate);
      const dow = d.getDay(); // 1:Mon, 3:Wed
      const monOrWed = dow === 1 || dow === 3;
      if (monOrWed) return PERIOD_ORDER;
      return (PERIOD_ORDER as unknown as readonly string[]).filter(k => k !== '7') as unknown as typeof PERIOD_ORDER;
    } catch {
      return PERIOD_ORDER;
    }
  }, [selectedDate]);

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
            {availableOrder.map(key => {
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
                {availableOrder.map(key => {
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
                {availableOrder.map(key => {
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
