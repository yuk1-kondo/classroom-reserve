import React, { useMemo, useState } from 'react';
import RecurringTemplatesManager from './RecurringTemplatesManager';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { applyTemplateLocks, removeTemplateLocks } from '../../firebase/templateLocks';
import './RecurringTemplatesModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  currentUserId?: string;
  roomOptions: { id: string; name: string }[];
}

export default function RecurringTemplatesModal({ open, onClose, isAdmin, currentUserId, roomOptions }: Props) {
  const { maxDateStr, limitMonths } = useSystemSettings();
  const todayStr = useMemo(() => new Date().toISOString().slice(0,10), []);
  const defaultEnd = useMemo(() => {
    if (maxDateStr) return maxDateStr;
    const d = new Date(); d.setMonth(d.getMonth() + (limitMonths || 3));
    return d.toISOString().slice(0,10);
  }, [maxDateStr, limitMonths]);

  const [rangeStart, setRangeStart] = useState<string>(todayStr);
  const [rangeEnd, setRangeEnd] = useState<string>(defaultEnd);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [busyRemove, setBusyRemove] = useState(false);

  if (!open) return null;

  const clampEnd = (val: string) => {
    if (maxDateStr && val > maxDateStr) return maxDateStr;
    return val;
  };

  const handleApplyLocks = async () => {
    if (!isAdmin) return;
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      alert('適用期間を正しく指定してください');
      return;
    }
    setBusy(true);
    setMessage('テンプレートを適用中...');
    try {
      const res = await applyTemplateLocks(rangeStart, rangeEnd, currentUserId);
      setMessage(`✅ ロック生成完了: 追加 ${res.created} / 既存 ${res.skipped}`);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ 失敗: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleRemoveLocks = async () => {
    if (!isAdmin) return;
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      alert('削除期間を正しく指定してください');
      return;
    }
    if (!window.confirm('指定期間のテンプレロックを削除します。よろしいですか？')) return;
    setBusyRemove(true);
    setMessage('テンプレートロックを削除中...');
    try {
      const res = await removeTemplateLocks(rangeStart, rangeEnd);
      setMessage(`✅ ロック削除完了: ${res.deleted} 件`);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ 失敗: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusyRemove(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="rtm-modal-backdrop">
      <div className="rtm-modal">
        <div className="rtm-modal-header">
          <h3>固定（毎週）予約テンプレート</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="rtm-modal-body">
          <div className="rtm-pane">
            <h4>テンプレート一覧/編集</h4>
            <RecurringTemplatesManager isAdmin={isAdmin} currentUserId={currentUserId} roomOptions={roomOptions} />
          </div>
          <div className="rtm-pane">
            <h4>テンプレート適用（ロック生成）</h4>
            <div className="form-row">
              <label>開始日</label>
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            </div>
            <div className="form-row">
              <label>終了日</label>
              <input type="date" value={rangeEnd} max={maxDateStr || undefined} onChange={e => setRangeEnd(clampEnd(e.target.value))} />
            </div>
            <div className="hint">最大予約日: {maxDateStr ? maxDateStr : `（未設定: 約${limitMonths || 3}ヶ月先）`}</div>
            <div className="actions" style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleApplyLocks} disabled={!isAdmin || busy}>ロック生成</button>
              <button onClick={handleRemoveLocks} disabled={!isAdmin || busyRemove}>ロック削除</button>
            </div>
            {message && <div className="msg">{message}</div>}
            <div className="note">注: ロックは予約スロットに作成され、通常の予約作成をブロックします。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
