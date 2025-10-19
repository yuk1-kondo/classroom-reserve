import React, { useMemo, useState } from 'react';
import RecurringTemplatesManager from './RecurringTemplatesManager';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { applyTemplatesAsReservations } from '../../firebase/templateLocks';
import { reservationsService } from '../../firebase/firestore';
import './RecurringTemplatesModal.css';
import CsvBulkReservations from './CsvBulkReservations';

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
  const [busyBulkDelete, setBusyBulkDelete] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [includeId, setIncludeId] = useState(true);
  const [includeCreatedAt, setIncludeCreatedAt] = useState(true);
  const [includeCreatedByUid, setIncludeCreatedByUid] = useState(true);

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
      // 通常予約として作成（カレンダーに表示され、手動削除可能）
      const res = await applyTemplatesAsReservations(rangeStart, rangeEnd, currentUserId, { forceOverride: false });
      setMessage(`✅ 予約作成完了: 追加 ${res.created} / 既存 ${res.skipped}`);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ 失敗: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 期間内の予約を一括削除（作成者フィルタなし）
  const handleBulkDeleteReservations = async () => {
    if (!isAdmin) return;
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      alert('削除期間を正しく指定してください');
      return;
    }
    if (!window.confirm(`期間 ${rangeStart} 〜 ${rangeEnd} の全予約を一括削除します。よろしいですか？`)) return;
    try {
      setBusyBulkDelete(true);
      const deleted = await reservationsService.deleteReservationsInRange(rangeStart, rangeEnd);
      alert(`期間削除 完了: ${deleted} 件`);
    } catch (e: any) {
      console.error(e);
      alert(`削除に失敗しました: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusyBulkDelete(false);
    }
  };

  // 期間内の予約をCSVエクスポート
  const handleExportCsv = async () => {
    if (!isAdmin) return;
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      alert('エクスポート期間を正しく指定してください');
      return;
    }
    try {
      setBusyExport(true);
      const csv = await reservationsService.exportReservationsCsv(rangeStart, rangeEnd, {
        includeId,
        includeCreatedAt,
        includeCreatedByUid
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservations_${rangeStart}_${rangeEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(`エクスポートに失敗しました: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusyExport(false);
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
            <h4>テンプレート適用（予約作成）</h4>
            <div className="form-row">
              <label>開始日</label>
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} title="テンプレート適用の開始日" />
            </div>
            <div className="form-row">
              <label>終了日</label>
              <input type="date" value={rangeEnd} max={maxDateStr || undefined} onChange={e => setRangeEnd(clampEnd(e.target.value))} title="テンプレート適用の終了日" />
            </div>
            <div className="hint">最大予約日: {maxDateStr ? maxDateStr : '（未設定）'}</div>
            <div className="actions">
              <button onClick={handleApplyLocks} disabled={!isAdmin || busy}>予約作成</button>
              <button onClick={handleBulkDeleteReservations} disabled={!isAdmin || busyBulkDelete} title="期間内の全予約を削除">期間内の予約削除</button>
              <button onClick={handleExportCsv} disabled={!isAdmin || busyExport} title="期間内の予約をCSVでエクスポート">CSVエクスポート</button>
            </div>
            <div className="form-row rtm-export-options">
              <label><input type="checkbox" checked={includeId} onChange={e=>setIncludeId(e.target.checked)} /> 予約ID</label>
              <label><input type="checkbox" checked={includeCreatedAt} onChange={e=>setIncludeCreatedAt(e.target.checked)} /> 作成日時</label>
              <label><input type="checkbox" checked={includeCreatedByUid} onChange={e=>setIncludeCreatedByUid(e.target.checked)} /> 作成者UID</label>
            </div>
            {message && <div className="msg">{message}</div>}
            <div className="note">注: ここで作成された予約は通常の予約と同じ扱いでカレンダーに表示・削除できます。</div>
          </div>
          <div className="rtm-pane">
            <h4>CSV一括固定予約（週間定義 × 期間適用）</h4>
            <CsvBulkReservations currentUserId={currentUserId} roomOptions={roomOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
