import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';
import { Reservation } from '../../firebase/firestore';
import { ParkingSpot, parkingReservationsService } from '../../firebase/parking';
import { PeriodRangeSelector } from '../PeriodRangeSelector';
import { PeriodRangeState } from '../../hooks/useReservationForm';
import { createDateTimeFromPeriod, getPeriodOrderForDate } from '../../utils/periods';
import { displayLabel } from '../../utils/periodLabel';
import { useParkingReservations } from '../../contexts/ParkingReservationsContext';
import '../ReservationModal.css';
import '../ReservationForm.css';

interface Props {
  open: boolean;
  date: string;
  spotId: string;
  period: string;
  spots: ParkingSpot[];
  currentUserUid: string;
  currentUserName: string;
  onClose: () => void;
}

export const ParkingCreateModal: React.FC<Props> = ({
  open,
  date,
  spotId,
  period,
  spots,
  currentUserUid,
  currentUserName,
  onClose
}) => {
  const { reservations, addReservations } = useParkingReservations();
  const [selectedSpot, setSelectedSpot] = useState(spotId);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [periodRange, setPeriodRange] = useState<PeriodRangeState>({
    startPeriod: period,
    endPeriod: period,
    isRangeMode: false
  });
  const [title, setTitle] = useState('');
  const [reservationName, setReservationName] = useState(currentUserName);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedSpot(spotId);
    setSelectedPeriod(period);
    setPeriodRange({ startPeriod: period, endPeriod: period, isRangeMode: false });
    setTitle('');
    setReservationName(currentUserName);
  }, [open, spotId, period, currentUserName]);

  const periodsToReserve = useMemo(() => {
    if (!periodRange.isRangeMode) {
      return selectedPeriod ? [selectedPeriod] : [];
    }
    const order = getPeriodOrderForDate(date);
    const startIndex = order.indexOf(periodRange.startPeriod as typeof order[number]);
    const endIndex = order.indexOf(periodRange.endPeriod as typeof order[number]);
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return [];
    return order.slice(startIndex, endIndex + 1) as string[];
  }, [periodRange, selectedPeriod, date]);

  if (!open) return null;

  const handleCreate = async () => {
    const spot = spots.find(s => s.id === selectedSpot);
    if (!spot) {
      toast.error('駐車場が見つかりません');
      return;
    }
    if (periodsToReserve.length === 0 || !title.trim() || !reservationName.trim()) {
      toast.error('すべての項目を入力してください');
      return;
    }

    const occupied = reservations.some(r => {
      if (r.roomId !== selectedSpot) return false;
      const rDate = (r.startTime as Timestamp).toDate();
      const y = rDate.getFullYear();
      const m = String(rDate.getMonth() + 1).padStart(2, '0');
      const d = String(rDate.getDate()).padStart(2, '0');
      if (`${y}-${m}-${d}` !== date) return false;
      const reserved = r.period.includes(',') ? r.period.split(',').map(p => p.trim()) : [r.period];
      return periodsToReserve.some(p => reserved.includes(p));
    });
    if (occupied) {
      toast.error('同じ駐車場・時限の予約が既に存在します');
      return;
    }

    try {
      setLoading(true);
      const startPeriod = periodsToReserve[0];
      const endPeriod = periodsToReserve[periodsToReserve.length - 1];
      const startDt = createDateTimeFromPeriod(date, startPeriod);
      const endDt = createDateTimeFromPeriod(date, endPeriod);
      if (!startDt || !endDt) throw new Error('時限の時間計算に失敗しました');

      const reservation: Omit<Reservation, 'id'> = {
        roomId: String(spot.id),
        roomName: spot.name,
        title: title.trim(),
        reservationName: reservationName.trim(),
        startTime: Timestamp.fromDate(startDt.start),
        endTime: Timestamp.fromDate(endDt.end),
        period: periodsToReserve.join(','),
        periodName:
          periodsToReserve.length > 1
            ? `${displayLabel(startPeriod)}〜${displayLabel(endPeriod)}`
            : displayLabel(startPeriod),
        createdBy: currentUserUid
      };

      const id = await parkingReservationsService.addReservation(reservation);
      const created = await parkingReservationsService.getReservationById(id);
      if (created) addReservations([created]);
      window.dispatchEvent(new CustomEvent('parking:changed', { detail: { type: 'created', id } }));
      toast.success(periodsToReserve.length > 1 ? `予約を作成しました（${periodsToReserve.length}時限連続）` : '予約を作成しました');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || '予約の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reservation-modal-overlay" onClick={onClose}>
      <div className="reservation-modal compact" onClick={e => e.stopPropagation()}>
        <div className="reservation-modal-header">
          <h2>駐車場を予約</h2>
          <button className="close-button" onClick={onClose} disabled={loading}>✕</button>
        </div>
        <div className="reservation-modal-body">
          <div className="reservation-form">
            <div className="form-group">
              <label>日付:</label>
              <input type="text" value={date} disabled />
            </div>
            <div className="form-group">
              <label>駐車場:</label>
              <select
                value={selectedSpot}
                onChange={e => setSelectedSpot(e.target.value)}
                disabled={loading}
                aria-label="駐車場を選択"
              >
                {spots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <PeriodRangeSelector
              periodRange={periodRange}
              setPeriodRange={setPeriodRange}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              loading={loading}
              reservations={reservations}
              selectedRoom={selectedSpot}
              selectedDate={date}
            />
            <div className="form-group">
              <label>予約者:</label>
              <input
                type="text"
                value={reservationName}
                onChange={e => setReservationName(e.target.value)}
                disabled={loading}
                maxLength={30}
              />
            </div>
            <div className="form-group">
              <label>予約内容:</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={loading}
                maxLength={40}
                placeholder="例: 出張"
              />
            </div>
          </div>
        </div>
        <div className="reservation-actions">
          <button className="edit-button" onClick={handleCreate} disabled={loading}>
            {loading ? '作成中…' : '予約する'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingCreateModal;
