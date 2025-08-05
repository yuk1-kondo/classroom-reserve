// 予約フォーム状態管理用カスタムフック
import { useState, useEffect, useCallback } from 'react';
import { Room, Reservation, reservationsService, createDateTimeFromPeriod, periodTimeMap } from '../firebase/firestore';
import { AuthUser } from '../firebase/auth';
import { Timestamp } from 'firebase/firestore';

export interface FormData {
  selectedRoom: string;
  selectedPeriod: string;
  title: string;
  reservationName: string;
}

export interface DateRangeState {
  startDate: string;
  endDate: string;
  isRangeMode: boolean;
}

export interface PeriodRangeState {
  startPeriod: string;
  endPeriod: string;
  isRangeMode: boolean;
}

export const useReservationForm = (
  selectedDate?: string,
  currentUser?: AuthUser | null,
  rooms: Room[] = [],
  onReservationCreated?: () => void
) => {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState<FormData>({
    selectedRoom: '',
    selectedPeriod: '',
    title: '',
    reservationName: ''
  });

  // 日付範囲選択（ホテル風）
  const [dateRange, setDateRange] = useState<DateRangeState>({
    startDate: selectedDate || '',
    endDate: selectedDate || '',
    isRangeMode: false
  });

  // 時限範囲選択
  const [periodRange, setPeriodRange] = useState<PeriodRangeState>({
    startPeriod: '',
    endPeriod: '',
    isRangeMode: false
  });

  // selectedDateが変更されたときの日付範囲更新
  useEffect(() => {
    if (selectedDate) {
      setDateRange(prev => ({
        ...prev,
        startDate: selectedDate,
        endDate: selectedDate
      }));
    }
  }, [selectedDate]);

  // currentUserが変更されたときの予約者名更新
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        reservationName: currentUser.displayName || currentUser.name || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        reservationName: ''
      }));
    }
  }, [currentUser]);

  // roomsが変更されたときの初期教室設定
  useEffect(() => {
    if (rooms.length > 0 && !formData.selectedRoom) {
      setFormData(prev => ({ ...prev, selectedRoom: rooms[0].id! }));
    }
  }, [rooms, formData.selectedRoom]);

  // フォーム入力の更新
  const updateFormData = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 日付リスト生成関数
  const generateDateList = useCallback((startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }, []);

  // 時限リスト生成関数
  const generatePeriodList = useCallback((startPeriod: string, endPeriod: string): string[] => {
    const periods = ['0', '1', '2', '3', '4', '5', '6'];
    const startIndex = periods.indexOf(startPeriod);
    const endIndex = periods.indexOf(endPeriod);
    
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return [];
    }
    
    return periods.slice(startIndex, endIndex + 1);
  }, []);

  // 予約に使用する日付配列を取得
  const getReservationDates = useCallback((): string[] => {
    return dateRange.isRangeMode
      ? generateDateList(dateRange.startDate, dateRange.endDate)
      : selectedDate ? [selectedDate] : [];
  }, [dateRange.isRangeMode, dateRange.startDate, dateRange.endDate, selectedDate, generateDateList]);

  // 予約に使用する時限配列を取得
  const getReservationPeriods = useCallback((): string[] => {
    return periodRange.isRangeMode
      ? generatePeriodList(periodRange.startPeriod, periodRange.endPeriod)
      : formData.selectedPeriod ? [formData.selectedPeriod] : [];
  }, [periodRange.isRangeMode, periodRange.startPeriod, periodRange.endPeriod, formData.selectedPeriod, generatePeriodList]);

  // 予約作成
  const handleCreateReservation = async (): Promise<void> => {
    if (!currentUser) {
      alert('予約を作成するにはログインが必要です');
      return;
    }

    const datesToReserve = getReservationDates();
    const periodsToReserve = getReservationPeriods();

    if (datesToReserve.length === 0 || !formData.selectedRoom || periodsToReserve.length === 0 || 
        !formData.title.trim() || !formData.reservationName.trim()) {
      alert('すべての項目を入力してください');
      return;
    }

    try {
      setLoading(true);
      const room = rooms.find(r => r.id === formData.selectedRoom);
      if (!room) {
        alert('教室が見つかりません');
        return;
      }

      // 日付×時限の全組み合わせで予約作成
      const reservationPromises: Promise<any>[] = [];
      
      for (const date of datesToReserve) {
        if (periodsToReserve.length === 1) {
          // 単一時限の場合は従来通り
          const period = periodsToReserve[0];
          const dateTime = createDateTimeFromPeriod(date, period);
          if (!dateTime) {
            throw new Error(`日時の作成に失敗しました: ${date} ${period}限`);
          }

          const reservation: Omit<Reservation, 'id'> = {
            roomId: formData.selectedRoom,
            roomName: room.name,
            title: formData.title.trim(),
            reservationName: formData.reservationName.trim(),
            startTime: Timestamp.fromDate(dateTime.start),
            endTime: Timestamp.fromDate(dateTime.end),
            period: period,
            periodName: periodTimeMap[period as keyof typeof periodTimeMap]?.name || `${period}限`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.uid
          };

          reservationPromises.push(reservationsService.addReservation(reservation));
        } else {
          // 複数時限の場合は連続した一つの予約として作成
          const startPeriod = periodsToReserve[0];
          const endPeriod = periodsToReserve[periodsToReserve.length - 1];
          
          const startDateTime = createDateTimeFromPeriod(date, startPeriod);
          const endDateTime = createDateTimeFromPeriod(date, endPeriod);
          
          if (!startDateTime || !endDateTime) {
            throw new Error(`日時の作成に失敗しました: ${date} ${startPeriod}-${endPeriod}限`);
          }

          // 複数時限の期間名を作成
          const periodName = periodsToReserve.length > 1 
            ? `${periodTimeMap[startPeriod as keyof typeof periodTimeMap]?.name || `${startPeriod}限`} - ${periodTimeMap[endPeriod as keyof typeof periodTimeMap]?.name || `${endPeriod}限`}`
            : periodTimeMap[startPeriod as keyof typeof periodTimeMap]?.name || `${startPeriod}限`;

          const reservation: Omit<Reservation, 'id'> = {
            roomId: formData.selectedRoom,
            roomName: room.name,
            title: formData.title.trim(),
            reservationName: formData.reservationName.trim(),
            startTime: Timestamp.fromDate(startDateTime.start),
            endTime: Timestamp.fromDate(endDateTime.end), // 最後の時限の終了時刻
            period: periodsToReserve.join(','), // 複数時限をカンマ区切りで保存
            periodName: periodName,
            createdAt: Timestamp.now(),
            createdBy: currentUser.uid
          };

          reservationPromises.push(reservationsService.addReservation(reservation));
        }
      }

      await Promise.all(reservationPromises);
      
      // フォームリセット
      resetForm();
      
      if (onReservationCreated) {
        onReservationCreated();
      }
      
      const totalReservations = datesToReserve.length; // 実際に作成される予約件数は日数分
      if (totalReservations > 1) {
        if (periodsToReserve.length > 1) {
          alert(`${totalReservations}件の予約を作成しました（${datesToReserve.length}日間 × ${periodsToReserve.length}時限連続）`);
        } else {
          alert(`${totalReservations}件の予約を作成しました（${datesToReserve.length}日間）`);
        }
      } else {
        if (periodsToReserve.length > 1) {
          alert(`予約を作成しました（${periodsToReserve.length}時限連続）`);
        } else {
          alert('予約を作成しました');
        }
      }
    } catch (error) {
      console.error('予約作成エラー:', error);
      alert('予約の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // フォームリセット
  const resetForm = useCallback(() => {
    setFormData(prev => ({
      selectedRoom: prev.selectedRoom,
      selectedPeriod: '',
      title: '',
      reservationName: prev.reservationName
    }));
    setShowForm(false);
    
    // 日付・時限範囲モードをリセット
    if (selectedDate) {
      setDateRange({
        isRangeMode: false,
        startDate: selectedDate,
        endDate: selectedDate,
      });
    }
    
    setPeriodRange({
      isRangeMode: false,
      startPeriod: '',
      endPeriod: '',
    });
  }, [selectedDate]);

  return {
    showForm,
    setShowForm,
    loading,
    formData,
    setFormData,
    updateFormData,
    dateRange,
    setDateRange,
    periodRange,
    setPeriodRange,
    handleCreateReservation,
    resetForm,
    getReservationDates,
    getReservationPeriods,
    generateDateList,
    generatePeriodList
  };
};
