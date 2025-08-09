// リファクタリング版サイドパネルコンポーネント - 予約作成・表示用
import React, { useEffect, useState } from 'react';
import { UserSection } from './UserSection';
import { ReservationForm } from './ReservationForm';
import SimpleLogin from './SimpleLogin';
import { useReservationData } from '../hooks/useReservationData';
import { useAuth } from '../hooks/useAuth';
import { useReservationForm } from '../hooks/useReservationForm';
import { useConflictDetection } from '../hooks/useConflictDetection';
import { reservationsService } from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
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
  // カスタムフックで状態管理を分離
  const { currentUser, showLoginModal, setShowLoginModal, handleLoginSuccess, handleLogout } = useAuth();
  const { rooms, reservations } = useReservationData(currentUser, selectedDate);
  const formHook = useReservationForm(selectedDate, currentUser, rooms, onReservationCreated);
  const { conflictCheck, performConflictCheck } = useConflictDetection();
  
  // 必要な値/関数だけ分解（useEffect依存の安定化）
  const { showForm, formData, getReservationDates, getReservationPeriods } = formHook;
  const { selectedRoom } = formData;
  
  // 管理者機能の表示状態
  const [csvExporting, setCsvExporting] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');
  
  // 管理者権限チェック
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;

  // CSV エクスポート機能
  const handleCsvExport = async () => {
    if (!isAdmin) return;
    
    setCsvExporting(true);
    setCsvMessage('予約データを取得中...');
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      
      const reservations = await reservationsService.getReservations(startDate, endDate);
      
      if (reservations.length === 0) {
        setCsvMessage('エクスポートする予約データがありません');
        setTimeout(() => setCsvMessage(''), 3000);
        return;
      }
      
      // 簡単なCSV形式でエクスポート
      const csvHeaders = ['日付', '時間', '教室', '予約名', '予約者'];
      const csvData = reservations.map(reservation => [
        reservation.startTime.toDate().toLocaleDateString('ja-JP'),
        reservation.periodName || reservation.period,
        reservation.roomName || reservation.roomId,
        reservation.reservationName || reservation.title,
        reservation.createdBy || '不明'
      ]);
      
      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `reservations_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setCsvMessage(`✅ ${reservations.length}件の予約データをエクスポートしました`);
      setTimeout(() => setCsvMessage(''), 3000);
      
    } catch (error) {
      console.error('CSV export error:', error);
      setCsvMessage('❌ エクスポートに失敗しました');
      setTimeout(() => setCsvMessage(''), 3000);
    } finally {
      setCsvExporting(false);
    }
  };

  // CSV インポート機能
  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isAdmin) return;

    const confirmed = window.confirm('⚠️ CSVファイルから予約データをインポートします。よろしいですか？');
    if (!confirmed) {
      event.target.value = '';
      return;
    }

    setCsvImporting(true);
    setCsvMessage('CSVファイルを読み込み中...');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length <= 1) {
        setCsvMessage('❌ CSVファイルにデータが含まれていません');
        return;
      }

      // ヘッダー行をスキップ
      const dataLines = lines.slice(1);
      let successCount = 0;
      let failedCount = 0;

      setCsvMessage(`${dataLines.length}件の予約データをインポート中...`);

      for (const line of dataLines) {
        try {
          const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
          
          if (columns.length < 5) continue;

          const [dateStr, timeStr, roomId, reservationName, createdBy] = columns;
          
          // 日付解析
          const dateParts = dateStr.split('/');
          if (dateParts.length !== 3) continue;
          
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]) - 1;
          const day = parseInt(dateParts[2]);
          
          // 時間解析（"1時間目" -> "1"）
          const period = timeStr.replace(/時間目/, '');
          
          const startDate = new Date(year, month, day, 9 + parseInt(period) - 1, 0);
          const endDate = new Date(year, month, day, 10 + parseInt(period) - 1, 0);

          const reservation = {
            roomId: roomId,
            roomName: roomId,
            title: reservationName,
            reservationName: reservationName,
            startTime: Timestamp.fromDate(startDate),
            endTime: Timestamp.fromDate(endDate),
            period: period,
            periodName: `${period}時間目`,
            createdBy: createdBy || 'CSV import'
          };

          await reservationsService.addReservation(reservation);
          successCount++;
        } catch (error) {
          console.error('予約インポートエラー:', error);
          failedCount++;
        }
      }

      setCsvMessage(`✅ インポート完了: 成功 ${successCount}件 / 失敗 ${failedCount}件`);
      setTimeout(() => setCsvMessage(''), 5000);

    } catch (error) {
      console.error('CSV import error:', error);
      setCsvMessage('❌ CSVファイルの読み込みに失敗しました');
      setTimeout(() => setCsvMessage(''), 3000);
    } finally {
      setCsvImporting(false);
      event.target.value = '';
    }
  };

  // 一括削除機能
  const handleBulkDelete = async () => {
    if (!isAdmin) return;

    const confirmed = window.confirm('⚠️ 警告: すべての予約データを削除します。この操作は取り消せません。本当に実行しますか？');
    if (!confirmed) return;

    const doubleConfirmed = window.confirm('🚨 最終確認: 本当にすべての予約データを削除しますか？');
    if (!doubleConfirmed) return;

    setBulkDeleting(true);
    setCsvMessage('予約データを取得中...');

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 10);
      
      const reservations = await reservationsService.getReservations(startDate, endDate);
      
      if (reservations.length === 0) {
        setCsvMessage('削除する予約データがありません');
        setTimeout(() => setCsvMessage(''), 3000);
        return;
      }

      setCsvMessage(`${reservations.length}件の予約データを削除中...`);
      
      let deletedCount = 0;
      for (const reservation of reservations) {
        if (reservation.id) {
          await reservationsService.deleteReservation(reservation.id);
          deletedCount++;
        }
      }

      setCsvMessage(`✅ ${deletedCount}件の予約データを削除しました`);
      setTimeout(() => setCsvMessage(''), 5000);

    } catch (error) {
      console.error('Bulk delete error:', error);
      setCsvMessage('❌ 一括削除に失敗しました');
      setTimeout(() => setCsvMessage(''), 3000);
    } finally {
      setBulkDeleting(false);
    }
  };

  // 重複チェックを実行するためのエフェクト
  useEffect(() => {
    if (showForm) {
      const timeoutId = setTimeout(() => {
        const datesToCheck = getReservationDates();
        const periodsToCheck = getReservationPeriods();
        
        if (datesToCheck.length > 0 && periodsToCheck.length > 0 && selectedRoom) {
          performConflictCheck(datesToCheck, periodsToCheck, selectedRoom);
        }
      }, 300); // デバウンス: 300ms待ってからチェック実行
      
      return () => clearTimeout(timeoutId);
    }
  }, [showForm, selectedRoom, getReservationDates, getReservationPeriods, performConflictCheck]);

  // ログインモーダル: ESCで閉じる
  useEffect(() => {
    if (!showLoginModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLoginModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLoginModal, setShowLoginModal]);

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

  return (
    <div className="side-panel">
      <div className="only-mobile mobile-inline-close-wrapper">
        <button onClick={onClose} aria-label="閉じる" className="mobile-inline-close-btn">✕ 閉じる</button>
      </div>
      {/* ユーザー情報セクション */}
      <UserSection
        currentUser={currentUser}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      <div className="side-panel-header">
        <h3>📅 予約管理</h3>
      </div>

      {selectedDate ? (
        <div className="side-panel-content">
          <div className="selected-date">
            <h4>{formatDate(selectedDate)}</h4>
          </div>

          {/* 予約作成フォーム */}
          <ReservationForm
            showForm={formHook.showForm}
            onShowForm={formHook.setShowForm}
            loading={formHook.loading}
            currentUser={currentUser}
            formData={formHook.formData}
            updateFormData={formHook.updateFormData}
            dateRange={formHook.dateRange}
            setDateRange={formHook.setDateRange}
            periodRange={formHook.periodRange}
            setPeriodRange={formHook.setPeriodRange}
            rooms={rooms}
            conflictCheck={conflictCheck}
            onCreateReservation={formHook.handleCreateReservation}
            reservations={reservations}
            selectedDate={selectedDate}
          />

          {/* 管理者機能セクション */}
          {isAdmin && (
            <div className="admin-section">
              <h4>🔧 管理者機能</h4>
              {csvMessage && (
                <div className={`csv-message ${csvMessage.includes('❌') ? 'error' : 'success'}`}>
                  {csvMessage}
                </div>
              )}
              <div className="admin-functions">
                <button 
                  onClick={handleCsvExport}
                  disabled={csvExporting || csvImporting || bulkDeleting}
                  className="admin-btn csv-btn"
                >
                  📄 {csvExporting ? 'エクスポート中...' : 'CSV出力'}
                </button>
                
                <label className="admin-btn import-btn">
                  📥 {csvImporting ? 'インポート中...' : 'CSV入力'}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvImport}
                    disabled={csvExporting || csvImporting || bulkDeleting}
                    className="hidden-file-input"
                  />
                </label>
                
                <button 
                  onClick={handleBulkDelete}
                  disabled={csvExporting || csvImporting || bulkDeleting}
                  className="admin-btn delete-btn"
                >
                  🗑️ {bulkDeleting ? '削除中...' : '一括削除'}
                </button>
              </div>
            </div>
          )}

          {/* 実用的な運用案内メッセージ */}
          <div className="info-message">
            <p>⚠️ 教室予約済みの場合は先生間で相談して変更して下さい</p>
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
