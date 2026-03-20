// 予約禁止期間設定コンポーネント
import React, { useEffect, useState } from 'react';
import { blockedPeriodsService, BlockedPeriod } from '../../firebase/blockedPeriods';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface Props {
  currentUserId?: string | null;
  roomOptions?: { id: string; name: string }[];
  hideTitle?: boolean;
}

export const BlockedPeriodsSettings: React.FC<Props> = ({ currentUserId, roomOptions = [], hideTitle }) => {
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
    <div className="admin-settings-block">
      {!hideTitle && <h5 className="admin-settings-block__title">予約禁止期間設定</h5>}

      {loading && <div className="admin-settings-block__loading">読み込み中…</div>}

      {/* 登録済み一覧 */}
      {!loading && blockedPeriods.length > 0 && (
        <div className="admin-settings-block__list-wrap">
          <p className="admin-settings-block__sub-title">登録済みの禁止期間:</p>
          <ul className="admin-settings-block__list">
            {blockedPeriods.map(bp => (
              <li key={bp.id} className="admin-settings-block__list-item">
                <div>
                  <strong>{formatDate(bp.startDate)} 〜 {formatDate(bp.endDate)}</strong>
                  {bp.roomName && <span className="admin-settings-block__meta">({bp.roomName})</span>}
                  {!bp.roomId && <span className="admin-settings-block__meta admin-settings-block__meta--danger">(全教室)</span>}
                  {bp.reason && <div className="admin-settings-block__reason">{bp.reason}</div>}
                </div>
                <button
                  type="button"
                  className="admin-settings-block__btn admin-settings-block__btn--small admin-settings-block__btn--danger"
                  onClick={() => bp.id && handleRemove(bp.id)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && blockedPeriods.length === 0 && !showForm && (
        <p className="admin-settings-block__empty">禁止期間は設定されていません</p>
      )}

      {/* 追加ボタン */}
      {!showForm && (
        <button
          type="button"
          className="admin-settings-block__btn admin-settings-block__btn--primary"
          onClick={() => setShowForm(true)}
        >
          ＋ 禁止期間を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div className="admin-settings-block__form">
          <div className="admin-settings-block__field-wrap">
            <label htmlFor="blocked-start-date" className="admin-settings-block__label admin-settings-block__label--block">開始日</label>
            <input
              id="blocked-start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="開始日"
              className="admin-settings-block__field"
            />
          </div>
          <div className="admin-settings-block__field-wrap">
            <label htmlFor="blocked-end-date" className="admin-settings-block__label admin-settings-block__label--block">終了日</label>
            <input
              id="blocked-end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="終了日"
              className="admin-settings-block__field"
            />
          </div>
          <div className="admin-settings-block__field-wrap">
            <label htmlFor="blocked-room" className="admin-settings-block__label admin-settings-block__label--block">対象教室（空欄=全教室）</label>
            <select
              id="blocked-room"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              title="対象教室"
              className="admin-settings-block__field"
            >
              <option value="">全教室</option>
              {roomOptions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="admin-settings-block__field-wrap admin-settings-block__field-wrap--last">
            <label className="admin-settings-block__label admin-settings-block__label--block">理由（任意）</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="例: 春休み、設備点検"
              className="admin-settings-block__field"
            />
          </div>
          <div className="admin-settings-block__actions">
            <button
              type="button"
              className="admin-settings-block__btn admin-settings-block__btn--primary"
              onClick={handleAdd}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              className="admin-settings-block__btn admin-settings-block__btn--muted"
              onClick={() => {
                setShowForm(false);
                setStartDate('');
                setEndDate('');
                setRoomId('');
                setReason('');
              }}
              disabled={saving}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <p className="admin-settings-block__note">
        ※ 禁止期間中は一般ユーザーが予約できません（管理者は可能）
      </p>
    </div>
  );
};

export default BlockedPeriodsSettings;
