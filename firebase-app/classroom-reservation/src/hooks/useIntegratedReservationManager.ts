// 統合予約管理フック
import { useState, useEffect, useCallback, useMemo } from 'react';
import { reservationsService, Reservation, Room, periodTimeMap, createDateTimeFromPeriod } from '../firebase/firestore';
import { AuthUser } from '../firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { useConflictDetection } from './useConflictDetection';
import { DataIntegrityService, MASTER_ROOMS } from '../firebase/dataIntegrity';

// フォームデータ型
export interface FormData {
  selectedRoom: string;
  selectedPeriod: string;
  title: string;
  reservationName: string;
}

// 日付範囲型
export interface DateRangeState {
  startDate: string;
  endDate: string;
  isRangeMode: boolean;
}

// 時限範囲型
export interface PeriodRangeState {
  startPeriod: string;
  endPeriod: string;
  isRangeMode: boolean;
}

// 統合予約管理フック
export const useIntegratedReservationManager = (
  selectedDate?: string,
  currentUser?: AuthUser | null,
  onReservationCreated?: () => void
) => {
  // データ状態
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // フォーム状態
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    selectedRoom: '',
    selectedPeriod: '',
    title: '',
    reservationName: ''
  });

  // 日付範囲選択
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

  // コンフリクト検出
  const { conflictCheck, performConflictCheck } = useConflictDetection();

  // マスターデータから教室一覧を取得（常に利用可能）
  const masterRooms = useMemo((): Room[] => 
    MASTER_ROOMS.map(room => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      description: room.description
    })), []
  );

  // データ整合性チェック・ロード
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // データ整合性チェック・自動復旧
      const dataService = DataIntegrityService.getInstance();
      await dataService.checkAndRepairData();
      
      // マスターデータを使用（常に利用可能）
      setRooms(masterRooms);
      setDataReady(true);
      
    } catch (error) {
      console.error('データロードエラー:', error);
      // エラーでもマスターデータは使用可能
      setRooms(masterRooms);
      setDataReady(true);
    } finally {
      setLoading(false);
    }
  }, [masterRooms]);

  // 指定日の予約を取得
  const loadReservationsForDate = useCallback(async (date: string) => {
    if (!date) return;
    
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const reservationsData = await reservationsService.getReservations(startOfDay, endOfDay);
      setReservations(reservationsData);
    } catch (error) {
      console.error('予約データ取得エラー:', error);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初期化
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 選択日変更時の処理
  useEffect(() => {
    if (selectedDate) {
      setDateRange(prev => ({
        ...prev,
        startDate: selectedDate,
        endDate: selectedDate
      }));
      loadReservationsForDate(selectedDate);
    }
  }, [selectedDate, loadReservationsForDate]);

  // 予約者名の自動設定
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

  // フォーム入力の更新
  const updateFormData = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 日付リスト生成
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

  // 時限リスト生成
  const generatePeriodList = useCallback((startPeriod: string, endPeriod: string): string[] => {
    const periods = ['0', '1', '2', '3', '4', '5', '6', '7', 'after'];
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
  const handleCreateReservation = useCallback(async (): Promise<void> => {
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

      // 予約作成処理
      const reservationPromises: Promise<any>[] = [];
      
      for (const date of datesToReserve) {
        if (periodsToReserve.length === 1) {
          // 単一時限
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
          // 複数時限
          const startPeriod = periodsToReserve[0];
          const endPeriod = periodsToReserve[periodsToReserve.length - 1];
          
          const startDateTime = createDateTimeFromPeriod(date, startPeriod);
          const endDateTime = createDateTimeFromPeriod(date, endPeriod);
          
          if (!startDateTime || !endDateTime) {
            throw new Error(`日時の作成に失敗しました: ${date} ${startPeriod}-${endPeriod}限`);
          }

          const periodName = periodsToReserve.length > 1 
            ? `${periodTimeMap[startPeriod as keyof typeof periodTimeMap]?.name || `${startPeriod}限`} - ${periodTimeMap[endPeriod as keyof typeof periodTimeMap]?.name || `${endPeriod}限`}`
            : periodTimeMap[startPeriod as keyof typeof periodTimeMap]?.name || `${startPeriod}限`;

          const reservation: Omit<Reservation, 'id'> = {
            roomId: formData.selectedRoom,
            roomName: room.name,
            title: formData.title.trim(),
            reservationName: formData.reservationName.trim(),
            startTime: Timestamp.fromDate(startDateTime.start),
            endTime: Timestamp.fromDate(endDateTime.end),
            period: periodsToReserve.join(','),
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

      alert('予約を作成しました');
    } catch (error) {
      console.error('予約作成エラー:', error);
      alert('予約の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [currentUser, formData, dateRange, periodRange, rooms, getReservationDates, getReservationPeriods, onReservationCreated]);

  // フォームリセット
  const resetForm = useCallback(() => {
    setFormData({
      selectedRoom: '',
      selectedPeriod: '',
      title: '',
      reservationName: currentUser?.displayName || currentUser?.name || ''
    });
    setDateRange({
      startDate: selectedDate || '',
      endDate: selectedDate || '',
      isRangeMode: false
    });
    setPeriodRange({
      startPeriod: '',
      endPeriod: '',
      isRangeMode: false
    });
    setShowForm(false);
  }, [currentUser, selectedDate]);

  // コンフリクト検出の自動実行
  useEffect(() => {
    if (showForm && dataReady) {
      const timeoutId = setTimeout(() => {
        const datesToCheck = getReservationDates();
        const periodsToCheck = getReservationPeriods();
        
        if (datesToCheck.length > 0 && periodsToCheck.length > 0 && formData.selectedRoom) {
          performConflictCheck(datesToCheck, periodsToCheck, formData.selectedRoom);
        }
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [showForm, dataReady, formData.selectedRoom, dateRange, periodRange, formData.selectedPeriod, getReservationDates, getReservationPeriods, performConflictCheck]);

  return {
    // データ状態
    rooms,
    reservations,
    loading,
    dataReady,
    
    // フォーム状態
    showForm,
    setShowForm,
    formData,
    updateFormData,
    
    // 範囲選択状態
    dateRange,
    setDateRange,
    periodRange,
    setPeriodRange,
    
    // コンフリクト検出
    conflictCheck,
    
    // アクション
    handleCreateReservation,
    loadReservationsForDate,
    resetForm,
    getReservationDates,
    getReservationPeriods
  };
};
