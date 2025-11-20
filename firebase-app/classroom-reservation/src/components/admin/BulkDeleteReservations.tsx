import React, { useState } from 'react';
import { reservationsService } from '../../firebase/firestore';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import './BulkDeleteReservations.css';

interface Props {
  roomOptions: { id: string; name: string }[];
  isAdmin: boolean;
}

export default function BulkDeleteReservations({ roomOptions, isAdmin }: Props) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(''); // '' means all rooms
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleDelete = async () => {
    if (!isAdmin) return;
    if (!startDate || !endDate) {
      alert('開始日と終了日を指定してください');
      return;
    }
    if (startDate > endDate) {
      alert('期間が正しくありません');
      return;
    }

    const targetRoomName = selectedRoomId 
      ? roomOptions.find(r => r.id === selectedRoomId)?.name || '指定教室'
      : '全教室';

    const confirmMsg = `⚠️ 注意: 削除されたデータは元に戻せません。\n\n` +
      `期間: ${startDate} 〜 ${endDate}\n` +
      `対象: ${targetRoomName}\n\n` +
      `本当に削除してよろしいですか？`;

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setMessage('削除中...');

    try {
      const count = await reservationsService.deleteReservationsInRange(
        startDate, 
        endDate, 
        selectedRoomId ? { roomId: selectedRoomId } : undefined
      );
      setMessage(`✅ 削除完了: ${count}件の予約を削除しました`);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ エラー: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bulk-delete-wrap">
      <h4>予約一括削除（期間指定）</h4>
      <div className="bulk-delete-note">
        指定した期間内の予約をまとめて削除します。<br/>
        <strong>※この操作は取り消せません。慎重に行ってください。</strong>
      </div>
      
      <div className="form-row">
        <label>期間設定</label>
        <div className="date-range-inputs">
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            disabled={busy}
          />
          <span>〜</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            disabled={busy}
          />
        </div>
      </div>

      <div className="form-row">
        <label>対象教室</label>
        <select 
          value={selectedRoomId} 
          onChange={e => setSelectedRoomId(e.target.value)}
          disabled={busy}
        >
          <option value="">すべての教室</option>
          {roomOptions.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div className="actions">
        <button 
          onClick={handleDelete} 
          disabled={busy || !startDate || !endDate}
          className="delete-btn"
        >
          {busy ? '処理中...' : '一括削除を実行'}
        </button>
      </div>

      {message && <div className={`msg ${message.startsWith('❌') ? 'error' : 'success'}`}>{message}</div>}
    </div>
  );
}

