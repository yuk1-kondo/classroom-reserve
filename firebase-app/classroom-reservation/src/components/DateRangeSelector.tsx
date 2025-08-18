// 日付範囲選択コンポーネント
import React from 'react';
import { DateRangeState } from '../hooks/useReservationForm';

interface DateRangeSelectorProps {
  dateRange: DateRangeState;
  setDateRange: React.Dispatch<React.SetStateAction<DateRangeState>>;
  loading: boolean;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  setDateRange,
  loading
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
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value, endDate: e.target.value }))}
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
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  disabled={loading}
                  aria-label="開始日を選択"
                />
              </div>
              <div className="date-input-group">
                <label>終了日:</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  disabled={loading}
                  aria-label="終了日を選択"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
