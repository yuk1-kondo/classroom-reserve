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
  // 管理者フラグ（管理者の場合は日付制限をスキップ）
  isAdmin?: boolean;
  /** 進路指導部＋会議室など、先日付制限をスキップする場合 */
  bypassSystemReservationDateLimit?: boolean;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  setDateRange,
  loading,
  maxDateStr,
  limitMonths,
  isAdmin = false,
  bypassSystemReservationDateLimit = false
}) => {
  // 管理者または特例の場合は日付上限を無効化
  const effectiveMaxDateStr =
    isAdmin || bypassSystemReservationDateLimit ? undefined : maxDateStr;
  const noClamp = isAdmin || bypassSystemReservationDateLimit;
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
                max={effectiveMaxDateStr}
                onChange={(e) => {
                  const v = noClamp ? e.target.value : clampToMax(e.target.value, effectiveMaxDateStr);
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
                max={effectiveMaxDateStr}
                onChange={(e) => {
                  const v = noClamp ? e.target.value : clampToMax(e.target.value, effectiveMaxDateStr);
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
                max={effectiveMaxDateStr}
                onChange={(e) => {
                  const v = noClamp ? e.target.value : clampToMax(e.target.value, effectiveMaxDateStr);
                  setDateRange(prev => ({ ...prev, endDate: v }));
                }}
                disabled={loading}
                aria-label="終了日を選択"
              />
              </div>
            </>
          )}
        </div>
        {effectiveMaxDateStr && !noClamp && (
          <div className="helper-text" aria-live="polite">
            予約は{effectiveMaxDateStr}まで選択できます。
          </div>
        )}
        {isAdmin && (
          <div className="helper-text admin-hint" aria-live="polite" style={{ color: '#0066cc', fontWeight: 'bold' }}>
            ⚙️ 管理者モード: 日付制限なしで予約できます
          </div>
        )}
      </div>
    </div>
  );
};
