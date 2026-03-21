// 予約禁止期間設定コンポーネント
import React, { useEffect, useState, useCallback } from 'react';
import { blockedPeriodsService, BlockedPeriod, getRoomLabel } from '../../firebase/blockedPeriods';
import { useAuth } from '../../hooks/useAuth';
import { PERIOD_ORDER, periodTimeMap } from '../../utils/periods';
import toast from 'react-hot-toast';

const PERIOD_OPTIONS = PERIOD_ORDER.map(key => ({
  key,
  label: periodTimeMap[key].name,
}));

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
  const [reason, setReason] = useState('');

  // 教室: all / select
  const [roomMode, setRoomMode] = useState<'all' | 'select'>('all');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  // 時限: all / select
  const [periodMode, setPeriodMode] = useState<'all' | 'select'>('all');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await blockedPeriodsService.getAll();
      setBlockedPeriods(data);
    } catch (e) {
      console.error('禁止期間読み込みエラー:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRoom = (id: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const togglePeriod = (key: string) => {
    setSelectedPeriods(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setRoomMode('all');
    setSelectedRoomIds([]);
    setPeriodMode('all');
    setSelectedPeriods([]);
  };

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
    if (roomMode === 'select' && selectedRoomIds.length === 0) {
      toast.error('禁止する教室を1つ以上選択してください');
      return;
    }
    if (periodMode === 'select' && selectedPeriods.length === 0) {
      toast.error('禁止する時限を1つ以上選択してください');
      return;
    }

    try {
      setSaving(true);
      const roomIds = roomMode === 'select' ? selectedRoomIds : null;
      const roomNames = roomMode === 'select'
        ? selectedRoomIds.map(id => roomOptions.find(r => r.id === id)?.name || id)
        : null;
      const periods = periodMode === 'select' ? selectedPeriods : null;

      await blockedPeriodsService.add({
        startDate,
        endDate,
        roomId: null,
        roomName: null,
        roomIds,
        roomNames,
        periods,
        reason: reason || null,
        createdBy: currentUserId
      });
      toast.success('禁止期間を追加しました');
      resetForm();
      setShowForm(false);
      await loadData();
    } catch (e: any) {
      console.error('禁止期間追加エラー:', e);
      toast.error('追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatPeriods = (bp: BlockedPeriod): string => {
    if (!bp.periods || bp.periods.length === 0) return '全時限';
    return bp.periods
      .map(k => periodTimeMap[k as keyof typeof periodTimeMap]?.name || k)
      .join(', ');
  };

  const isAllRooms = (bp: BlockedPeriod): boolean => {
    if (bp.roomIds && bp.roomIds.length > 0) return false;
    if (bp.roomId) return false;
    return true;
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
                  {isAllRooms(bp)
                    ? <span className="admin-settings-block__meta admin-settings-block__meta--danger"> (全教室)</span>
                    : <span className="admin-settings-block__meta"> ({getRoomLabel(bp)})</span>
                  }
                  <span className="admin-settings-block__meta"> [{formatPeriods(bp)}]</span>
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

          {/* 対象教室 */}
          <div className="admin-settings-block__field-wrap">
            <span className="admin-settings-block__label admin-settings-block__label--block">対象教室</span>
            <div className="blocked-periods__period-mode">
              <label className="blocked-periods__radio-label">
                <input
                  type="radio"
                  name="roomMode"
                  value="all"
                  checked={roomMode === 'all'}
                  onChange={() => setRoomMode('all')}
                />
                全教室
              </label>
              <label className="blocked-periods__radio-label">
                <input
                  type="radio"
                  name="roomMode"
                  value="select"
                  checked={roomMode === 'select'}
                  onChange={() => setRoomMode('select')}
                />
                教室を指定
              </label>
            </div>
            {roomMode === 'select' && (
              <div className="blocked-periods__period-toggles">
                {roomOptions.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    className={
                      selectedRoomIds.includes(r.id)
                        ? 'blocked-periods__toggle blocked-periods__toggle--active'
                        : 'blocked-periods__toggle'
                    }
                    onClick={() => toggleRoom(r.id)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 対象時限 */}
          <div className="admin-settings-block__field-wrap">
            <span className="admin-settings-block__label admin-settings-block__label--block">対象時限</span>
            <div className="blocked-periods__period-mode">
              <label className="blocked-periods__radio-label">
                <input
                  type="radio"
                  name="periodMode"
                  value="all"
                  checked={periodMode === 'all'}
                  onChange={() => setPeriodMode('all')}
                />
                全時限
              </label>
              <label className="blocked-periods__radio-label">
                <input
                  type="radio"
                  name="periodMode"
                  value="select"
                  checked={periodMode === 'select'}
                  onChange={() => setPeriodMode('select')}
                />
                時限を指定
              </label>
            </div>
            {periodMode === 'select' && (
              <div className="blocked-periods__period-toggles">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    className={
                      selectedPeriods.includes(opt.key)
                        ? 'blocked-periods__toggle blocked-periods__toggle--active'
                        : 'blocked-periods__toggle'
                    }
                    onClick={() => togglePeriod(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
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
                resetForm();
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
