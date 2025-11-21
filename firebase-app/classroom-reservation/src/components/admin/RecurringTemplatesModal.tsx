import React, { useMemo, useState } from 'react';
import RecurringTemplatesManager from './RecurringTemplatesManager';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { applyTemplateReservations } from '../../firebase/templateReservations';
import CsvBulkReservations from './CsvBulkReservations';
import BulkDeleteReservations from './BulkDeleteReservations';
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
  const [busyReserve, setBusyReserve] = useState(false);
  const [messageReserve, setMessageReserve] = useState<string>('');

  if (!open) return null;

  const clampEnd = (val: string) => {
    if (maxDateStr && val > maxDateStr) return maxDateStr;
    return val;
  };

  const handleApplyReservations = async () => {
    if (!isAdmin) return;
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      alert('適用期間を正しく指定してください');
      return;
    }
    setBusyReserve(true);
    setMessageReserve('テンプレートから実予約を作成中...');
    try {
      const res = await applyTemplateReservations(rangeStart, rangeEnd, currentUserId);
      setMessageReserve(`✅ 実予約生成: 作成 ${res.created} / 重複 ${res.skipped} / 失敗 ${res.errors}`);
    } catch (e: any) {
      console.error(e);
      setMessageReserve(`❌ 失敗: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusyReserve(false);
      setTimeout(() => setMessageReserve(''), 7000);
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
          <div className="rtm-column-left">
            <div className="rtm-pane">
              <h4>テンプレート一覧/編集</h4>
              <RecurringTemplatesManager isAdmin={isAdmin} currentUserId={currentUserId} roomOptions={roomOptions} />
            </div>
            
            <div className="rtm-pane">
              <h4>テンプレートから予約を生成</h4>
              <div className="hint" style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                左側（上部）で作成したテンプレートを指定期間に適用して、実際の予約を作成します。
              </div>
              <div className="form-row">
                <label>開始日</label>
                <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} title="テンプレート適用の開始日" />
              </div>
              <div className="form-row">
                <label>終了日</label>
                <input type="date" value={rangeEnd} max={maxDateStr || undefined} onChange={e => setRangeEnd(clampEnd(e.target.value))} title="テンプレート適用の終了日" />
              </div>
              <div className="hint">最大予約日: {maxDateStr ? maxDateStr : '（未設定）'}</div>
              <div className="hint">注: 既存の予約がある場合は自動的にスキップされます（上書きされません）。</div>
              <div className="actions">
                <button onClick={handleApplyReservations} disabled={!isAdmin || busyReserve}>予約を生成</button>
              </div>
              {messageReserve && <div className="msg">{messageReserve}</div>}
            </div>
          </div>

          <div className="rtm-column-right">
            <div className="rtm-pane">
              <h4>CSV一括予約</h4>
              <CsvBulkReservations currentUserId={currentUserId} roomOptions={roomOptions} isAdmin={isAdmin} />
            </div>
            
            {isAdmin && (
              <div className="rtm-pane" style={{ marginTop: '16px', borderColor: '#ffcccc', backgroundColor: '#fffcfc' }}>
                <BulkDeleteReservations roomOptions={roomOptions} isAdmin={isAdmin} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
