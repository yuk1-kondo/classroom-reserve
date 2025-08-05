// サイドパネルコンポーネント - 予約作成・表示用（リファクタリング版）
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

  // 予約作成
  const handleCreateReservation = async () => {
    if (!currentUser) {
      alert('予約を作成するにはログインが必要です');
      setShowLoginModal(true);
      return;
    }

    if (!selectedDate || !formData.selectedRoom || !formData.selectedPeriod || 
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

      const dateTime = createDateTimeFromPeriod(selectedDate, formData.selectedPeriod);
      if (!dateTime) {
        alert('日時の作成に失敗しました');
        return;
      }

      const reservation: Omit<Reservation, 'id'> = {
        roomId: formData.selectedRoom,
        roomName: room.name,
        title: formData.title.trim(),
        reservationName: formData.reservationName.trim(),
        startTime: Timestamp.fromDate(dateTime.start),
        endTime: Timestamp.fromDate(dateTime.end),
        period: formData.selectedPeriod,
        periodName: periodTimeMap[formData.selectedPeriod as keyof typeof periodTimeMap]?.name || formData.selectedPeriod,
        createdAt: Timestamp.now(),
        createdBy: currentUser.uid
      };

      await reservationsService.addReservation(reservation);
      
      // フォームリセット
      setFormData(prev => ({
        selectedRoom: prev.selectedRoom,
        selectedPeriod: '',
        title: '',
        reservationName: prev.reservationName
      }));
      setShowForm(false);
      
      // 予約一覧を再読み込み
      await loadReservationsForDate(selectedDate);
      
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
                disabled={loading || !currentUser}
              >
                ➕ 新しい予約を作成
              </button>
            ) : (
              <div className="reservation-form">
                <h5>📝 新しい予約</h5>
                
                <div className="form-group">
                  <label>教室:</label>
                  <select 
                    value={formData.selectedRoom} 
                    onChange={(e) => updateFormData('selectedRoom', e.target.value)}
                    disabled={loading}
                  >
                    <option value="">教室を選択</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>時限:</label>
                  <select 
                    value={formData.selectedPeriod} 
                    onChange={(e) => updateFormData('selectedPeriod', e.target.value)}
                    disabled={loading}
                  >
                    <option value="">時限を選択</option>
                    {Object.entries(periodTimeMap).map(([key, value]) => (
                      <option key={key} value={key}>{formatPeriod(key)}</option>
                    ))}
                  </select>
                </div>

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
                    className="submit-button"
                    onClick={handleCreateReservation}
                    disabled={loading}
                  >
                    {loading ? '作成中...' : '予約を作成'}
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
