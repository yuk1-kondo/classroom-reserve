// 予約作成フォームコンポーネント
import React from 'react';
import { Room } from '../firebase/firestore';
import { FormData, DateRangeState, PeriodRangeState } from '../hooks/useReservationForm';
import { ConflictCheckState } from '../hooks/useConflictDetection';
import { DateRangeSelector } from './DateRangeSelector';
import { PeriodRangeSelector } from './PeriodRangeSelector';
import { ConflictWarning } from './ConflictWarning';

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
  onCreateReservation
}) => {
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
            {rooms.map(room => (
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
        />

        {/* 重複警告メッセージ */}
        <ConflictWarning conflictCheck={conflictCheck} />

        <div className="form-group">
          <label>内容:</label>
          <input 
            type="text"
            value={formData.title}
            onChange={(e) => updateFormData('title', e.target.value)}
            placeholder="予約の内容を入力"
            disabled={loading}
          />
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
            {loading ? '作成中...' : 
             conflictCheck.hasConflict ? '重複のため予約不可' : '予約を作成'}
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
