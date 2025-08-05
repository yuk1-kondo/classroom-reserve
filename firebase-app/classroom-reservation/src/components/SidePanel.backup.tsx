// サイドパネルコンポーネント - 予約作成・表示用
import React, { useState, useEffect } from 'react';
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [title, setTitle] = useState('');
  const [reservationName, setReservationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // 連続予約用の状態
  const [isRecurringReservation, setIsRecurringReservation] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 時限範囲選択用の状態
  const [isMultiplePeriods, setIsMultiplePeriods] = useState(false);
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');

  // フォームが開かれるときの初期化
  useEffect(() => {
    if (showForm && selectedDate && !isRecurringReservation) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }
  }, [showForm, selectedDate, isRecurringReservation]);

  // 初期化時に現在のユーザーを取得
  useEffect(() => {
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
    if (user) {
      setReservationName(user.displayName || user.name || '');
    }
  }, []);

  // 教室データを取得
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const roomsData = await roomsService.getAllRooms();
        setRooms(roomsData);
        if (roomsData.length > 0) {
          setSelectedRoom(roomsData[0].id!);
        }
      } catch (error) {
        console.error('❌ 教室データ取得エラー:', error);
      }
    };
    
    loadRooms();
  }, []);

  // 選択日の予約データを取得
  useEffect(() => {
    if (selectedDate) {
      loadReservationsForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadReservationsForDate = async (dateStr: string) => {
    try {
      setLoading(true);
      const date = new Date(dateStr);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const reservationsData = await reservationsService.getReservations(date, nextDate);
      setReservations(reservationsData);
      console.log('📅 選択日の予約取得:', reservationsData.length + '件');
    } catch (error) {
      console.error('❌ 予約データ取得エラー:', error);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  // 日付範囲から日付配列を生成
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  // 時限範囲から時限配列を生成
  const generatePeriodRange = (start: string, end: string): string[] => {
    const periods: string[] = [];
    const allPeriods = Object.keys(periodTimeMap);
    
    const startIndex = allPeriods.indexOf(start);
    const endIndex = allPeriods.indexOf(end);
    
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return []; // 無効な範囲
    }
    
    for (let i = startIndex; i <= endIndex; i++) {
      periods.push(allPeriods[i]);
    }
    
    return periods;
  };

  // 連続時限の開始・終了時刻を計算
  const createContinuousPeriodDateTime = (date: string, startPeriod: string, endPeriod: string) => {
    const startDateTime = createDateTimeFromPeriod(date, startPeriod);
    const endDateTime = createDateTimeFromPeriod(date, endPeriod);
    
    if (!startDateTime || !endDateTime) {
      return null;
    }
    
    return {
      start: startDateTime.start,
      end: endDateTime.end
    };
  };

  // 時限範囲の表示名を生成
  const formatPeriodRange = (startPeriod: string, endPeriod: string): string => {
    if (startPeriod === endPeriod) {
      return periodTimeMap[startPeriod as keyof typeof periodTimeMap]?.name || startPeriod;
    }
    
    const startName = periodTimeMap[startPeriod as keyof typeof periodTimeMap]?.name || startPeriod;
    const endName = periodTimeMap[endPeriod as keyof typeof periodTimeMap]?.name || endPeriod;
    
    return `${startName}〜${endName}`;
  };

  // 予約の期間表示を整形（バッジ用）
  const formatReservationPeriod = (period: string): string => {
    // 連続時限の場合（例：period1-period6）
    if (period.includes('-')) {
      const [start, end] = period.split('-');
      return formatPeriodRange(start, end);
    }
    
    // 単一時限の場合
    return periodTimeMap[period as keyof typeof periodTimeMap]?.name || period;
  };

  // 予約作成
  const handleCreateReservation = async () => {
    // ユーザーログインチェック
    if (!currentUser) {
      alert('予約を作成するにはログインが必要です');
      setShowLoginModal(true);
      return;
    }

    // デバッグ用ログ
    console.log('🔍 バリデーションチェック:');
    console.log('- currentUser:', currentUser);
    console.log('- isRecurringReservation:', isRecurringReservation);
    console.log('- isMultiplePeriods:', isMultiplePeriods);
    console.log('- selectedDate:', selectedDate);
    console.log('- startDate:', startDate);
    console.log('- endDate:', endDate);
    console.log('- selectedRoom:', selectedRoom);
    console.log('- selectedPeriod:', selectedPeriod);
    console.log('- startPeriod:', startPeriod);
    console.log('- endPeriod:', endPeriod);
    console.log('- title:', `"${title}"`);
    console.log('- reservationName:', `"${reservationName}"`);
    
    // より詳細なバリデーション
    const errors = [];
    
    if (isRecurringReservation) {
      // 連続予約の場合
      if (!startDate) errors.push('開始日が選択されていません');
      if (!endDate) errors.push('終了日が選択されていません');
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        errors.push('終了日は開始日以降を選択してください');
      }
    } else {
      // 単発予約の場合
      if (!selectedDate) errors.push('日付が選択されていません');
    }
    
    if (isMultiplePeriods) {
      // 複数時限の場合
      if (!startPeriod) errors.push('開始時限が選択されていません');
      if (!endPeriod) errors.push('終了時限が選択されていません');
      const periodRange = generatePeriodRange(startPeriod, endPeriod);
      if (periodRange.length === 0) {
        errors.push('時限の範囲が無効です');
      }
    } else {
      // 単一時限の場合
      if (!selectedPeriod) errors.push('時限が選択されていません');
    }
    
    if (!selectedRoom) errors.push('教室が選択されていません');
    if (!title.trim()) errors.push('内容が入力されていません');
    if (!reservationName.trim()) errors.push('予約者名が入力されていません');
    
    if (errors.length > 0) {
      alert(`次の項目を確認してください:\n${errors.join('\n')}`);
      console.log('❌ バリデーションエラー:', errors);
      return;
    }

    try {
      setLoading(true);
      const room = rooms.find(r => r.id === selectedRoom);
      if (!room) {
        alert('教室が見つかりません');
        return;
      }

      // 予約する日付リストを決定
      const datesToReserve = isRecurringReservation 
        ? generateDateRange(startDate, endDate)
        : [selectedDate!];

      // 予約する時限リストを決定
      const periodsToReserve = isMultiplePeriods
        ? generatePeriodRange(startPeriod, endPeriod)
        : [selectedPeriod];

      console.log('📅 予約対象日数:', datesToReserve.length, '日');
      console.log('📅 予約対象日:', datesToReserve);
      console.log('⏰ 予約対象時限数:', periodsToReserve.length, '時限');
      console.log('⏰ 予約対象時限:', periodsToReserve);

      let successCount = 0;
      let failedReservations: string[] = [];

      // 各日付に対して予約を作成
      for (const reservationDate of datesToReserve) {
        try {
          if (isMultiplePeriods && periodsToReserve.length > 1) {
            // 連続時限の場合：1つの予約にまとめる
            const continuousDateTime = createContinuousPeriodDateTime(
              reservationDate, 
              periodsToReserve[0], 
              periodsToReserve[periodsToReserve.length - 1]
            );
            
            if (!continuousDateTime) {
              console.error('❌ 連続時限の日時作成エラー:', reservationDate);
              failedReservations.push(`${reservationDate} ${formatPeriodRange(periodsToReserve[0], periodsToReserve[periodsToReserve.length - 1])}`);
              continue;
            }

            const reservation: Omit<Reservation, 'id'> = {
              roomId: selectedRoom,
              roomName: room.name,
              title: title.trim(),
              reservationName: reservationName.trim(),
              startTime: Timestamp.fromDate(continuousDateTime.start),
              endTime: Timestamp.fromDate(continuousDateTime.end),
              period: `${periodsToReserve[0]}-${periodsToReserve[periodsToReserve.length - 1]}`,
              periodName: formatPeriodRange(periodsToReserve[0], periodsToReserve[periodsToReserve.length - 1]),
              createdAt: Timestamp.now(),
              createdBy: currentUser.uid
            };

            await reservationsService.addReservation(reservation);
            console.log('✅ 連続時限予約作成成功:', reservationDate, reservation.periodName);
            successCount++;
            
          } else {
            // 単一時限の場合：従来通り個別の予約
            for (const reservationPeriod of periodsToReserve) {
              const dateTime = createDateTimeFromPeriod(reservationDate, reservationPeriod);
              if (!dateTime) {
                console.error('❌ 日時作成エラー:', reservationDate, reservationPeriod);
                failedReservations.push(`${reservationDate} ${reservationPeriod}`);
                continue;
              }

              const reservation: Omit<Reservation, 'id'> = {
                roomId: selectedRoom,
                roomName: room.name,
                title: title.trim(),
                reservationName: reservationName.trim(),
                startTime: Timestamp.fromDate(dateTime.start),
                endTime: Timestamp.fromDate(dateTime.end),
                period: reservationPeriod,
                periodName: periodTimeMap[reservationPeriod as keyof typeof periodTimeMap]?.name || reservationPeriod,
                createdAt: Timestamp.now(),
                createdBy: currentUser.uid
              };

              await reservationsService.addReservation(reservation);
              console.log('✅ 単一時限予約作成成功:', reservationDate, reservationPeriod);
              successCount++;
            }
          }
            
        } catch (error) {
          console.error('❌ 予約作成エラー:', reservationDate, error);
          failedReservations.push(`${reservationDate}`);
        }
      }

      // 結果表示
      if (successCount > 0) {
        let message: string;
        
        if (isMultiplePeriods && periodsToReserve.length > 1) {
          // 連続時限の場合：日数分の予約が作成される
          const expectedCount = datesToReserve.length;
          message = datesToReserve.length === 1 
            ? `連続時限の予約を作成しました（${formatPeriodRange(periodsToReserve[0], periodsToReserve[periodsToReserve.length - 1])}）`
            : `${successCount}日分の連続時限予約を作成しました（${expectedCount}件中）`;
        } else {
          // 従来通りの場合
          const totalExpected = datesToReserve.length * periodsToReserve.length;
          message = `${successCount}件の予約を作成しました（${totalExpected}件中）`;
        }
        
        if (failedReservations.length > 0) {
          alert(`${message}\n\n失敗した予約:\n${failedReservations.join('\n')}`);
        } else {
          alert(message);
        }
      } else {
        alert('予約の作成に失敗しました');
      }
      
      // フォームをリセット
      setTitle('');
      setReservationName('');
      setSelectedPeriod('');
      setIsRecurringReservation(false);
      setStartDate('');
      setEndDate('');
      setIsMultiplePeriods(false);
      setStartPeriod('');
      setEndPeriod('');
      setShowForm(false);
      
      // 予約一覧を再読み込み（選択された日付があれば）
      if (selectedDate) {
        await loadReservationsForDate(selectedDate);
      }
      
      // 親コンポーネントに通知
      if (onReservationCreated) {
        onReservationCreated();
      }
      
    } catch (error) {
      console.error('❌ 予約作成エラー:', error);
      alert('予約の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 予約削除
  const handleDeleteReservation = async (reservationId: string) => {
    // 削除権限をチェック
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) {
      alert('予約が見つかりません');
      return;
    }

    if (!authService.canDeleteReservation(reservation.createdBy)) {
      alert('この予約を削除する権限がありません。\n自分が作成した予約のみ削除できます。');
      return;
    }

    if (!window.confirm('この予約を削除しますか？')) {
      return;
    }

    try {
      setLoading(true);
      await reservationsService.deleteReservation(reservationId);
      console.log('✅ 予約削除成功');
      
      // 予約一覧を再読み込み
      if (selectedDate) {
        await loadReservationsForDate(selectedDate);
      }
      
      // 親コンポーネントに通知
      if (onReservationCreated) {
        onReservationCreated();
      }
      
      alert('予約を削除しました');
    } catch (error) {
      console.error('❌ 予約削除エラー:', error);
      alert('予約の削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 時限をフォーマット
  const formatPeriod = (period: string): string => {
    const timeInfo = periodTimeMap[period as keyof typeof periodTimeMap];
    if (!timeInfo) return period;
    return `${timeInfo.name} (${timeInfo.start} - ${timeInfo.end})`;
  };

  // 日付をフォーマット
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // ログイン後の処理
  const handleLoginSuccess = () => {
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
    if (user) {
      setReservationName(user.displayName || user.name || '');
      console.log('✅ ログイン成功:', user);
    }
    setShowLoginModal(false);
  };

  // ログアウト処理
  const handleLogout = () => {
    authService.simpleLogout();
    setCurrentUser(null);
    setReservationName('');
    console.log('👋 ログアウト成功');
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
        {onClose && (
          <button 
            className="close-button"
            onClick={onClose}
            disabled={loading}
            aria-label="閉じる"
          >
            ✕
          </button>
        )}
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
                disabled={loading}
              >
                ➕ 新しい予約を作成
              </button>
            ) : (
              <div className="reservation-form">
                <h5>📝 新しい予約</h5>
                
                {/* 連続予約オプション */}
                <div className="form-group">
                  <label>
                    <input 
                      type="checkbox"
                      checked={isRecurringReservation}
                      onChange={(e) => setIsRecurringReservation(e.target.checked)}
                      disabled={loading}
                    />
                    📅 連続予約（複数日にまとめて予約）
                  </label>
                </div>

                {/* 日付選択 */}
                {isRecurringReservation ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="start-date">開始日:</label>
                      <input 
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="end-date">終了日:</label>
                      <input 
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={loading}
                        min={startDate}
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label>予約日:</label>
                    <span className="selected-date-display">
                      {selectedDate ? formatDate(selectedDate) : '日付を選択してください'}
                    </span>
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="room-select">教室:</label>
                  <select 
                    id="room-select"
                    value={selectedRoom} 
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    disabled={loading}
                    title="教室を選択してください"
                  >
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={isMultiplePeriods}
                      onChange={(e) => setIsMultiplePeriods(e.target.checked)}
                      disabled={loading}
                    />
                    複数時限をまとめて予約（例：1限〜6限）
                  </label>
                </div>

                {!isMultiplePeriods ? (
                  <div className="form-group">
                    <label htmlFor="period-select">時限:</label>
                    <select 
                      id="period-select"
                      value={selectedPeriod} 
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      disabled={loading}
                      title="時限を選択してください"
                    >
                      <option value="">時限を選択</option>
                      {Object.keys(periodTimeMap).map(period => (
                        <option key={period} value={period}>
                          {formatPeriod(period)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>時限範囲:</label>
                    <div className="period-range-container">
                      <select 
                        value={startPeriod} 
                        onChange={(e) => setStartPeriod(e.target.value)}
                        disabled={loading}
                        title="開始時限を選択してください"
                        className="period-range-select"
                      >
                        <option value="">開始時限</option>
                        {Object.keys(periodTimeMap).map(period => (
                          <option key={period} value={period}>
                            {formatPeriod(period)}
                          </option>
                        ))}
                      </select>
                      <span>〜</span>
                      <select 
                        value={endPeriod} 
                        onChange={(e) => setEndPeriod(e.target.value)}
                        disabled={loading}
                        title="終了時限を選択してください"
                        className="period-range-select"
                      >
                        <option value="">終了時限</option>
                        {Object.keys(periodTimeMap).map(period => (
                          <option key={period} value={period}>
                            {formatPeriod(period)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>内容:</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="授業名・会議名など"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>予約者名:</label>
                  <input 
                    type="text" 
                    value={reservationName} 
                    onChange={(e) => setReservationName(e.target.value)}
                    placeholder="担当者名"
                    disabled={loading}
                  />
                </div>

                <div className="form-actions">
                  <button 
                    className="save-button"
                    onClick={handleCreateReservation}
                    disabled={loading}
                  >
                    {loading ? '保存中...' : '💾 保存'}
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

          {/* 当日の予約一覧 */}
          <div className="reservations-list-section">
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
                      <span className="reservation-period">{formatReservationPeriod(reservation.period)}</span>
                      <span className="reservation-room">{reservation.roomName}</span>
                    </div>
                    <div className="reservation-title">{reservation.title}</div>
                    <div className="reservation-details">
                      <span className="reservation-name">予約者: {reservation.reservationName}</span>
                      <button 
                        className="delete-button"
                        onClick={() => handleDeleteReservation(reservation.id!)}
                        disabled={loading}
                        title="予約を削除"
                      >
                        🗑️
                      </button>
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
