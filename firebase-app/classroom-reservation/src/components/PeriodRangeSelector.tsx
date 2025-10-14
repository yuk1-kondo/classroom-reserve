// 時限範囲選択コンポーネント
import React from 'react';
import { PeriodRangeState } from '../hooks/useReservationForm';
import { Reservation, PERIOD_ORDER, ReservationSlot, createDateTimeFromPeriod } from '../firebase/firestore';
import { displayLabel } from '../utils/periodLabel';

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
  // 時限フォーマット（曜日に応じた時間帯を反映）
  const formatPeriod = (period: string): string => {
    const name = displayLabel(String(period));
    // 'YYYY/MM/DD' 入力も許容し、ISO 形式へ正規化
    const ds = (selectedDate || '').replace(/\//g, '-');
    const dt = ds ? createDateTimeFromPeriod(ds, period) : null;
    if (!dt) {
      // フォールバック: after は一般日のデフォルト 15:25 表示（Mon/Wed 以外）
      if (period === 'after') return `${name} (15:25 -)`;
      return name;
    }
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

  // 曜日により7限を隠す（Mon/Wed以外）
  const availableOrder = React.useMemo(() => {
    if (!selectedDate) return PERIOD_ORDER;
    try {
      // 'YYYY/MM/DD' を許容 → '-' に正規化してローカル日付として評価
      const normalized = String(selectedDate).replace(/\//g, '-');
      const d = new Date(`${normalized}T00:00:00`);
      const dow = d.getDay(); // 0:Sun,1:Mon,...,6:Sat
      // 月・水・土・日は7限を表示（=そのまま）。それ以外は7限を隠す
      const show7 = dow === 1 || dow === 3 || dow === 0 || dow === 6;
      if (show7) return PERIOD_ORDER;
      return (PERIOD_ORDER as unknown as readonly string[]).filter(k => k !== '7') as unknown as typeof PERIOD_ORDER;
    } catch {
      // パース失敗時は安全側（7限を隠す）
      return (PERIOD_ORDER as unknown as readonly string[]).filter(k => k !== '7') as unknown as typeof PERIOD_ORDER;
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
