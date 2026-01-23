// 予約禁止期間設定コンポーネント
import React, { useEffect, useState } from 'react';
import { blockedPeriodsService, BlockedPeriod } from '../../firebase/blockedPeriods';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface Props {
  currentUserId?: string | null;
  roomOptions?: { id: string; name: string }[];
}

export const BlockedPeriodsSettings: React.FC<Props> = ({ currentUserId, roomOptions = [] }) => {
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { isAdmin } = useAuth();

  // フォーム状態
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');

  // データ読み込み
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await blockedPeriodsService.getAll();
      setBlockedPeriods(data);
    } catch (e) {
      console.error('禁止期間読み込みエラー:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 追加処理
  const handleAdd = async () => {
    if (!currentUserId || !isAdmin) {
      toast.error('管理者権限が必要です');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('開始日と終了日を入力してください');
      return;
    }
    if (startDate > endDate) {
      toast.error('開始日は終了日より前にしてください');
      return;
    }

    try {
      setSaving(true);
      const roomName = roomId ? roomOptions.find(r => r.id === roomId)?.name : null;
      // Firestoreはundefinedを受け付けないため、nullを使用
      await blockedPeriodsService.add({
        startDate,
        endDate,
        roomId: roomId || null,
        roomName,
        reason: reason || null,
        createdBy: currentUserId
      });
      toast.success('禁止期間を追加しました');
      // フォームリセット
      setStartDate('');
      setEndDate('');
      setRoomId('');
      setReason('');
      setShowForm(false);
      await loadData();
    } catch (e: any) {
      console.error('禁止期間追加エラー:', e);
      toast.error('追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 削除処理
  const handleRemove = async (id: string) => {
    if (!window.confirm('この禁止期間を削除しますか？')) return;
    try {
      await blockedPeriodsService.remove(id);
      toast.success('禁止期間を削除しました');
      await loadData();
    } catch (e) {
      console.error('禁止期間削除エラー:', e);
      toast.error('削除に失敗しました');
    }
  };

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (!isAdmin) return null;

  return (
    <div className="admin-card rls-card">
      <h5 className="rls-title">🚫 予約禁止期間設定</h5>

      {loading && <div className="rls-loading">読み込み中…</div>}

      {/* 登録済み一覧 */}
      {!loading && blockedPeriods.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>登録済みの禁止期間:</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {blockedPeriods.map(bp => (
              <li key={bp.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                marginBottom: '4px',
                background: '#fff3f3',
                borderRadius: '4px',
                fontSize: '13px'
              }}>
                <div>
                  <strong>{formatDate(bp.startDate)} 〜 {formatDate(bp.endDate)}</strong>
                  {bp.roomName && <span style={{ marginLeft: '8px', color: '#666' }}>({bp.roomName})</span>}
                  {!bp.roomId && <span style={{ marginLeft: '8px', color: '#c00' }}>(全教室)</span>}
                  {bp.reason && <div style={{ fontSize: '12px', color: '#888' }}>{bp.reason}</div>}
                </div>
                <button
                  onClick={() => bp.id && handleRemove(bp.id)}
                  style={{
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && blockedPeriods.length === 0 && !showForm && (
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>禁止期間は設定されていません</p>
      )}

      {/* 追加ボタン */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          ＋ 禁止期間を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '12px', 
          borderRadius: '6px',
          marginTop: '8px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <label htmlFor="blocked-start-date" style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>開始日</label>
            <input
              id="blocked-start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="開始日"
              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label htmlFor="blocked-end-date" style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>終了日</label>
            <input
              id="blocked-end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="終了日"
              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label htmlFor="blocked-room" style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>対象教室（空欄=全教室）</label>
            <select
              id="blocked-room"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              title="対象教室"
              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">全教室</option>
              {roomOptions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>理由（任意）</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="例: 春休み、設備点検"
              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAdd}
              disabled={saving}
              style={{
                background: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setStartDate('');
                setEndDate('');
                setRoomId('');
                setReason('');
              }}
              disabled={saving}
              style={{
                background: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: '11px', color: '#888', marginTop: '12px' }}>
        ※ 禁止期間中は一般ユーザーが予約できません（管理者は可能）
      </p>
    </div>
  );
};

export default BlockedPeriodsSettings;
