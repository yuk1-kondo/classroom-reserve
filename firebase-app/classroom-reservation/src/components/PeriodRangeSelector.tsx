// 時限範囲選択コンポーネント
import React from 'react';
import { PeriodRangeState } from '../hooks/useReservationForm';
import { periodTimeMap } from '../firebase/firestore';

interface PeriodRangeSelectorProps {
  periodRange: PeriodRangeState;
  setPeriodRange: React.Dispatch<React.SetStateAction<PeriodRangeState>>;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
}

export const PeriodRangeSelector: React.FC<PeriodRangeSelectorProps> = ({
  periodRange,
  setPeriodRange,
  selectedPeriod,
  onPeriodChange,
  loading
}) => {
  // 時限フォーマット
  const formatPeriod = (period: string): string => {
    const timeInfo = periodTimeMap[period as keyof typeof periodTimeMap];
    if (!timeInfo) return period;
    return `${timeInfo.name} (${timeInfo.start} - ${timeInfo.end})`;
  };

  return (
    <div className="form-group">
      <label>時限:</label>
      
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
            {Object.entries(periodTimeMap).map(([key, value]) => (
              <option key={key} value={key}>{formatPeriod(key)}</option>
            ))}
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
                {Object.entries(periodTimeMap).map(([key, value]) => (
                  <option key={key} value={key}>{formatPeriod(key)}</option>
                ))}
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
                {Object.entries(periodTimeMap).map(([key, value]) => (
                  <option key={key} value={key}>{formatPeriod(key)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
