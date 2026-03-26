// 予約作成フォームコンポーネント
import React, { useMemo } from 'react';
import { Room, Reservation } from '../firebase/firestore';
import { FormData, DateRangeState, PeriodRangeState } from '../hooks/useReservationForm';
import { ConflictCheckState } from '../hooks/useConflictDetection';
import { DateRangeSelector } from './DateRangeSelector';
import { PeriodRangeSelector } from './PeriodRangeSelector';
import { ConflictWarning } from './ConflictWarning';
import './ReservationForm.css';

interface ReservationFormProps {
  showForm: boolean;
  onShowForm: (show: boolean) => void;
  loading: boolean;
  currentUser: any;
  formData: FormData;
  updateFormData: (field: keyof FormData, value: string) => void;
  dateRange: DateRangeState;
  setDateRange: React.Dispatch<React.SetStateAction<DateRangeState>>;
  periodRange: PeriodRangeState;
  setPeriodRange: React.Dispatch<React.SetStateAction<PeriodRangeState>>;
  rooms: Room[];
  conflictCheck: ConflictCheckState;
  onCreateReservation: () => void;
  reservations?: Reservation[];
  selectedDate?: string;
  // 予約制限: 最大日付（YYYY-MM-DD）と表示用月数
  maxDateStr?: string;
  limitMonths?: number;
  // 管理者フラグ（管理者の場合は日付制限をスキップ）
  isAdmin?: boolean;
}

export const ReservationForm: React.FC<ReservationFormProps> = ({
  showForm,
  onShowForm,
  loading,
  currentUser,
  formData,
  updateFormData,
  dateRange,
  setDateRange,
  periodRange,
  setPeriodRange,
  rooms,
  conflictCheck,
  onCreateReservation,
  reservations = [],
  selectedDate,
  maxDateStr,
  limitMonths,
  isAdmin = false
}) => {
  // カレンダー選択日が無い場合でも、フォームで選んだ日付を曜日判定に使う
  const effectiveSelectedDate = selectedDate || dateRange.startDate;
  
  // 教室リストのソート（useMemoで最適化）
  const sortedRooms = useMemo(() => {
    const customOrder = [
      'サテライト',
      '会議室',
      '図書館',
      '社会科教室',
      'グローバル教室①',
      'グローバル教室②',
      'LL教室',
      '小演習室1',
      '小演習室2',
      '小演習室3',
      '小演習室4',
      '小演習室5',
      '小演習室6',
      '大演習室1',
      '大演習室2',
      '大演習室3',
      '大演習室4',
      'モノラボ',
      '視聴覚教室',
      '多目的室'
    ];
    
    return [...rooms].sort((a, b) => {
      const indexA = customOrder.indexOf(a.name);
      const indexB = customOrder.indexOf(b.name);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [rooms]);
  
  if (!showForm) {
    return (
      <div className="reservation-form-section">
        <button 
          className="create-button"
          onClick={() => onShowForm(true)}
          disabled={loading || !currentUser}
        >
          ➕ 新しい予約を作成
        </button>
      </div>
    );
  }

  return (
    <div className="reservation-form-section">
      <div className="reservation-form">
        <h5>📝 新しい予約</h5>
        
        {/* 日付範囲選択 */}
        <DateRangeSelector
          dateRange={dateRange}
          setDateRange={setDateRange}
          loading={loading}
          maxDateStr={isAdmin ? undefined : maxDateStr}
          limitMonths={limitMonths}
          isAdmin={isAdmin}
        />
        
        <div className="form-group">
          <label>教室:</label>
          <select 
            value={formData.selectedRoom} 
            onChange={(e) => updateFormData('selectedRoom', e.target.value)}
            disabled={loading}
            aria-label="教室を選択"
          >
            <option value="">教室を選択</option>
            {sortedRooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>

        {/* 時限範囲選択 */}
        <PeriodRangeSelector
          periodRange={periodRange}
          setPeriodRange={setPeriodRange}
          selectedPeriod={formData.selectedPeriod}
          onPeriodChange={(period) => updateFormData('selectedPeriod', period)}
          loading={loading}
          reservations={reservations}
          selectedRoom={formData.selectedRoom}
          selectedDate={effectiveSelectedDate}
        />

        {/* 重複警告メッセージ */}
        <ConflictWarning conflictCheck={conflictCheck} />

        <div className="form-group">
          <label>内容:</label>
          <input 
            type="text"
            value={formData.title}
            onChange={(e) => updateFormData('title', e.target.value)}
            placeholder="予約の内容を入力（15文字まで）"
            maxLength={15}
            disabled={loading}
          />
          <div className="character-count" style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
            {formData.title.length}/15文字
          </div>
        </div>

        <div className="form-group">
          <label>予約者名:</label>
          <input 
            type="text"
            value={formData.reservationName}
            onChange={(e) => updateFormData('reservationName', e.target.value)}
            placeholder="予約者名を入力"
            disabled={loading}
          />
        </div>

        <div className="form-buttons">
          <button 
            className={`submit-button ${conflictCheck.hasConflict ? 'disabled conflict' : ''}`}
            onClick={onCreateReservation}
            disabled={loading || conflictCheck.hasConflict}
          >
            {loading ? '作成中...' : (
              conflictCheck.hasConflict ? (
                <>
                  <span>重複のため</span>
                  <span>予約不可</span>
                </>
              ) : '予約を作成'
            )}
          </button>
          <button 
            className="cancel-button"
            onClick={() => onShowForm(false)}
            disabled={loading}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
