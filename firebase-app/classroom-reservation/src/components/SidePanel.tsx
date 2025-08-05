// サイドパネルコンポーネント - 予約作成・表示用（リファクタリング版）
import React, { useState, useEffect, useCallback } from 'react';
import { 
  roomsService, 
  reservationsService, 
  Room, 
  Reservation,
  periodTimeMap,
  createDateTimeFromPeriod 
} from '../firebase/firestore';
import { authService, AuthUser } from '../firebase/auth';
import { Timestamp } from 'firebase/firestore';
import SimpleLogin from './SimpleLogin';
import './SidePanel.css';

interface SidePanelProps {
  selectedDate?: string;
  selectedEventId?: string;
  onClose?: () => void;
  onReservationCreated?: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  selectedDate,
  selectedEventId,
  onClose,
  onReservationCreated
}) => {
  // 基本状態
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // 認証状態
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // フォーム状態
  const [formData, setFormData] = useState({
    selectedRoom: '',
    selectedPeriod: '',
    title: '',
    reservationName: ''
  });

  // 日付範囲選択（ホテル風）
  const [dateRange, setDateRange] = useState({
    startDate: selectedDate || '',
    endDate: selectedDate || '',
    isRangeMode: false
  });

  // 時限範囲選択
  const [periodRange, setPeriodRange] = useState({
    startPeriod: '',
    endPeriod: '',
    isRangeMode: false
  });

  // 重複チェック状態
  const [conflictCheck, setConflictCheck] = useState({
    hasConflict: false,
    conflictMessage: '',
    conflictDetails: [] as string[]
  });

  // 初期化
  useEffect(() => {
    loadRooms();
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
    if (user) {
      setFormData(prev => ({
        ...prev,
        reservationName: user.displayName || user.name || ''
      }));
    }
  }, []);

  // 選択日が変更されたときの処理
  useEffect(() => {
    if (selectedDate) {
      loadReservationsForDate(selectedDate);
    }
  }, [selectedDate]);

  // 重複チェック関数
  const checkForConflicts = async (
    targetDates: string[], 
    targetPeriods: string[], 
    targetRoomId: string
  ): Promise<{ hasConflict: boolean; message: string; details: string[] }> => {
    if (!targetRoomId || targetDates.length === 0 || targetPeriods.length === 0) {
      return { hasConflict: false, message: '', details: [] };
    }

    try {
      const conflicts: string[] = [];
      
      for (const date of targetDates) {
        // その日の予約を取得
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingReservations = await reservationsService.getReservations(startOfDay, endOfDay);
        const roomReservations = existingReservations.filter(r => r.roomId === targetRoomId);
        
        for (const period of targetPeriods) {
          // 既存予約との重複をチェック
          const isConflict = roomReservations.some(reservation => {
            // 単一時限の場合
            if (!reservation.period.includes(',')) {
              return reservation.period === period;
            }
            
            // 複数時限の場合（カンマ区切り）
            const reservedPeriods = reservation.period.split(',');
            return reservedPeriods.includes(period);
          });
          
          if (isConflict) {
            const conflictingReservation = roomReservations.find(r => 
              r.period === period || r.period.split(',').includes(period)
            );
            const dateStr = new Date(date).toLocaleDateString('ja-JP');
            const periodName = periodTimeMap[period as keyof typeof periodTimeMap]?.name || `${period}限`;
            conflicts.push(`${dateStr} ${periodName} (${conflictingReservation?.title || '予約済み'})`);
          }
        }
      }
      
      if (conflicts.length > 0) {
        return {
          hasConflict: true,
          message: `選択した時間帯は既に予約されています`,
          details: conflicts
        };
      }
      
      return { hasConflict: false, message: '', details: [] };
    } catch (error) {
      console.error('重複チェックエラー:', error);
      return { hasConflict: false, message: '', details: [] };
    }
  };

  // フォーム変更時の重複チェック実行
  const performConflictCheck = useCallback(async () => {
    // 日付の配列を生成
    const datesToCheck = dateRange.isRangeMode
      ? generateDateList(dateRange.startDate, dateRange.endDate)
      : selectedDate ? [selectedDate] : [];

    // 時限の配列を生成
    const periodsToCheck = periodRange.isRangeMode
      ? generatePeriodList(periodRange.startPeriod, periodRange.endPeriod)
      : formData.selectedPeriod ? [formData.selectedPeriod] : [];

    if (datesToCheck.length === 0 || periodsToCheck.length === 0 || !formData.selectedRoom) {
      setConflictCheck({ hasConflict: false, conflictMessage: '', conflictDetails: [] });
      return;
    }

    const result = await checkForConflicts(datesToCheck, periodsToCheck, formData.selectedRoom);
    setConflictCheck({
      hasConflict: result.hasConflict,
      conflictMessage: result.message,
      conflictDetails: result.details
    });
  }, [
    dateRange.isRangeMode,
    dateRange.startDate,
    dateRange.endDate,
    selectedDate,
    periodRange.isRangeMode,
    periodRange.startPeriod,
    periodRange.endPeriod,
    formData.selectedPeriod,
    formData.selectedRoom
  ]);

  // フォーム項目変更時の重複チェック
  useEffect(() => {
    if (showForm) {
      const timeoutId = setTimeout(() => {
        performConflictCheck();
      }, 300); // デバウンス: 300ms待ってからチェック実行
      
      return () => clearTimeout(timeoutId);
    }
  }, [showForm, performConflictCheck]);

  // 教室データを取得
  const loadRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await roomsService.getAllRooms();
      setRooms(roomsData);
      if (roomsData.length > 0 && !formData.selectedRoom) {
        setFormData(prev => ({ ...prev, selectedRoom: roomsData[0].id! }));
      }
    } catch (error) {
      console.error('教室データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 指定日の予約を取得
  const loadReservationsForDate = async (date: string) => {
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const reservationsData = await reservationsService.getReservations(startOfDay, endOfDay);
      setReservations(reservationsData);
    } catch (error) {
      console.error('予約データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // フォーム入力の更新
  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 日付リスト生成関数
  const generateDateList = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  // 時限リスト生成関数
  const generatePeriodList = (startPeriod: string, endPeriod: string): string[] => {
    const periods = ['0', '1', '2', '3', '4', '5', '6'];
    const startIndex = periods.indexOf(startPeriod);
    const endIndex = periods.indexOf(endPeriod);
    
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return [];
    }
    
    return periods.slice(startIndex, endIndex + 1);
  };

  // 予約作成
  const handleCreateReservation = async () => {
    if (!currentUser) {
      alert('予約を作成するにはログインが必要です');
      setShowLoginModal(true);
      return;
    }

    // 日付の配列を生成
    const datesToReserve = dateRange.isRangeMode
      ? generateDateList(dateRange.startDate, dateRange.endDate)
      : selectedDate ? [selectedDate] : [];

    // 時限の配列を生成
    const periodsToReserve = periodRange.isRangeMode
      ? generatePeriodList(periodRange.startPeriod, periodRange.endPeriod)
      : formData.selectedPeriod ? [formData.selectedPeriod] : [];

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
      
      // 予約一覧を再読み込み
      if (selectedDate) {
        await loadReservationsForDate(selectedDate);
      }
      
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

  // 予約削除
  const handleDeleteReservation = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) {
      alert('予約が見つかりません');
      return;
    }

    if (!authService.canDeleteReservation(reservation.createdBy)) {
      alert('この予約を削除する権限がありません');
      return;
    }

    if (!window.confirm('この予約を削除しますか？')) {
      return;
    }

    try {
      setLoading(true);
      await reservationsService.deleteReservation(reservationId);
      await loadReservationsForDate(selectedDate!);
      
      if (onReservationCreated) {
        onReservationCreated();
      }
      
      alert('予約を削除しました');
    } catch (error) {
      console.error('予約削除エラー:', error);
      alert('予約の削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ログイン処理
  const handleLoginSuccess = () => {
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
    if (user) {
      setFormData(prev => ({
        ...prev,
        reservationName: user.displayName || user.name || ''
      }));
      console.log('ログイン成功:', user);
    }
    setShowLoginModal(false);
  };

  // ログアウト処理
  const handleLogout = () => {
    authService.simpleLogout();
    setCurrentUser(null);
    setFormData(prev => ({ ...prev, reservationName: '' }));
    console.log('ログアウト成功');
  };

  // 日付フォーマット
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 時限フォーマット
  const formatPeriod = (period: string): string => {
    const timeInfo = periodTimeMap[period as keyof typeof periodTimeMap];
    if (!timeInfo) return period;
    return `${timeInfo.name} (${timeInfo.start} - ${timeInfo.end})`;
  };

  // 時限が予約可能かチェック
  const isPeriodAvailable = async (period: string): Promise<boolean> => {
    if (!formData.selectedRoom || !selectedDate) return true;
    
    try {
      const startOfDay = new Date(selectedDate);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const existingReservations = await reservationsService.getReservations(startOfDay, endOfDay);
      const roomReservations = existingReservations.filter(r => r.roomId === formData.selectedRoom);
      
      return !roomReservations.some(reservation => {
        if (!reservation.period.includes(',')) {
          return reservation.period === period;
        }
        return reservation.period.split(',').includes(period);
      });
    } catch (error) {
      console.error('時限可用性チェックエラー:', error);
      return true; // エラー時は選択可能とする
    }
  };

  // 予約可能な時限リストを取得
  const getAvailablePeriods = async (): Promise<string[]> => {
    const allPeriods = Object.keys(periodTimeMap);
    const availableChecks = await Promise.all(
      allPeriods.map(async period => ({
        period,
        available: await isPeriodAvailable(period)
      }))
    );
    
    return availableChecks
      .filter(check => check.available)
      .map(check => check.period);
  };

  return (
    <div className="side-panel">
      {/* ユーザー情報セクション */}
      <div className="user-info-section">
        {currentUser ? (
          <div className="current-user-info">
            <div className="user-avatar">
              {currentUser.role === 'admin' ? '👩‍💼' : 
               currentUser.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
            </div>
            <div className="user-details">
              <div className="user-name">{currentUser.displayName || currentUser.name}</div>
              <div className="user-role">
                {currentUser.role === 'admin' ? '管理者' : 
                 currentUser.role === 'teacher' ? '教師' : '学生'}
              </div>
            </div>
            <button 
              className="logout-button"
              onClick={handleLogout}
              title="ログアウト"
            >
              🚪
            </button>
          </div>
        ) : (
          <div className="login-prompt">
            <div className="login-message">予約を作成するにはログインしてください</div>
            <button 
              className="login-button"
              onClick={() => setShowLoginModal(true)}
            >
              👤 ログイン
            </button>
          </div>
        )}
      </div>

      <div className="side-panel-header">
        <h3>📅 予約管理</h3>
        <div className="header-buttons">
          {onClose && (
            <button 
              className="close-button"
              onClick={onClose}
              disabled={loading}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {selectedDate ? (
        <div className="side-panel-content">
          <div className="selected-date">
            <h4>{formatDate(selectedDate)}</h4>
          </div>

          {/* 予約作成フォーム */}
          <div className="reservation-form-section">
            {!showForm ? (
              <button 
                className="create-button"
                onClick={() => setShowForm(true)}
                disabled={loading || !currentUser}
              >
                ➕ 新しい予約を作成
              </button>
            ) : (
              <div className="reservation-form">
                <h5>📝 新しい予約</h5>
                
                {/* 日付範囲選択 */}
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

                    {dateRange.isRangeMode && (
                      <div className="date-inputs">
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
                      </div>
                    )}
                  </div>
                </div>
                
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
                        value={formData.selectedPeriod} 
                        onChange={(e) => updateFormData('selectedPeriod', e.target.value)}
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

                {/* 重複警告メッセージ */}
                {conflictCheck.hasConflict && (
                  <div className="conflict-warning">
                    <div className="conflict-header">
                      ⚠️ {conflictCheck.conflictMessage}
                    </div>
                    {conflictCheck.conflictDetails.length > 0 && (
                      <div className="conflict-details">
                        {conflictCheck.conflictDetails.map((detail, index) => (
                          <div key={index} className="conflict-item">• {detail}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                    onClick={handleCreateReservation}
                    disabled={loading || conflictCheck.hasConflict}
                  >
                    {loading ? '作成中...' : 
                     conflictCheck.hasConflict ? '重複のため予約不可' : '予約を作成'}
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => setShowForm(false)}
                    disabled={loading}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 予約一覧 */}
          <div className="reservations-section">
            <h5>📋 当日の予約一覧</h5>
            {loading ? (
              <div className="loading-message">読み込み中...</div>
            ) : reservations.length === 0 ? (
              <div className="no-reservations">この日に予約はありません</div>
            ) : (
              <div className="reservations-list">
                {reservations.map(reservation => (
                  <div key={reservation.id} className="reservation-item">
                    <div className="reservation-header">
                      <span className="reservation-period">{formatPeriod(reservation.period)}</span>
                      <span className="reservation-room">{reservation.roomName}</span>
                    </div>
                    <div className="reservation-title">{reservation.title}</div>
                    <div className="reservation-details">
                      <span className="reservation-name">予約者: {reservation.reservationName}</span>
                      {authService.canDeleteReservation(reservation.createdBy) && (
                        <button 
                          className="delete-button"
                          onClick={() => handleDeleteReservation(reservation.id!)}
                          disabled={loading}
                          title="予約を削除"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="no-date-selected">
          <p>📅 カレンダーから日付をクリックして予約を管理してください</p>
        </div>
      )}
      
      {/* ログインモーダル */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SimpleLogin
              onAuthStateChange={handleLoginSuccess}
            />
            <button 
              className="modal-close-btn"
              onClick={() => setShowLoginModal(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
