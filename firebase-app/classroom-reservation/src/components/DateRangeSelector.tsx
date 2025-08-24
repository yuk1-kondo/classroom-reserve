// 日付範囲選択コンポーネント
import React from 'react';
import { clampToMax } from '../utils/dateValidation';
import { DateRangeState } from '../hooks/useReservationForm';

interface DateRangeSelectorProps {
  dateRange: DateRangeState;
  setDateRange: React.Dispatch<React.SetStateAction<DateRangeState>>;
  loading: boolean;
  // 予約可能な最大日付（YYYY-MM-DD）。未指定なら制限なし。
  maxDateStr?: string;
  // UI 表示用の月数（任意）
  limitMonths?: number;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  setDateRange,
  loading,
  maxDateStr,
  limitMonths
}) => {
  return (
    <div className="form-group">
      <label>日付:</label>
      
      <div className="date-range-selector">
        <div className="date-toggle">
          <label>
            <input
              type="radio"
              name="dateMode"
              checked={!dateRange.isRangeMode}
              onChange={() => setDateRange(prev => ({ ...prev, isRangeMode: false }))}
            />
            単日予約
          </label>
          <label>
            <input
              type="radio"
              name="dateMode"
              checked={dateRange.isRangeMode}
              onChange={() => setDateRange(prev => ({ ...prev, isRangeMode: true }))}
            />
            期間予約
          </label>
        </div>
        <div className="date-inputs">
          {/* 単日予約でも日付を明示的に選べるようにする */}
          {!dateRange.isRangeMode ? (
            <div className="date-input-group">
              <label>日付:</label>
              <input
                type="date"
                value={dateRange.startDate}
                max={maxDateStr}
                onChange={(e) => {
                  const v = clampToMax(e.target.value, maxDateStr);
                  setDateRange(prev => ({ ...prev, startDate: v, endDate: v }));
                }}
                disabled={loading}
                aria-label="日付を選択"
              />
            </div>
          ) : (
            <>
              <div className="date-input-group">
                <label>開始日:</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  max={maxDateStr}
                  onChange={(e) => {
                    const v = clampToMax(e.target.value, maxDateStr);
                    setDateRange(prev => ({ ...prev, startDate: v }));
                  }}
                  disabled={loading}
                  aria-label="開始日を選択"
                />
              </div>
              <div className="date-input-group">
                <label>終了日:</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  max={maxDateStr}
                  onChange={(e) => {
                    const v = clampToMax(e.target.value, maxDateStr);
                    setDateRange(prev => ({ ...prev, endDate: v }));
                  }}
                  disabled={loading}
                  aria-label="終了日を選択"
                />
              </div>
            </>
          )}
        </div>
        {maxDateStr && (
          <div className="helper-text" aria-live="polite" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            予約は{maxDateStr}まで選択できます。
          </div>
        )}
      </div>
    </div>
  );
};
