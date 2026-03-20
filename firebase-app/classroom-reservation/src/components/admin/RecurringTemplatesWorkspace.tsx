import React, { useMemo, useState } from 'react';
import RecurringTemplatesManager from './RecurringTemplatesManager';
import CsvBulkReservations from './CsvBulkReservations';
import BulkDeleteReservations from './BulkDeleteReservations';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { applyTemplateReservations } from '../../firebase/templateReservations';
import './RecurringTemplatesWorkspace.css';

interface Props {
  isAdmin: boolean;
  currentUserId?: string;
  roomOptions: { id: string; name: string }[];
}

export default function RecurringTemplatesWorkspace({ isAdmin, currentUserId, roomOptions }: Props) {
  const { maxDateStr, limitMonths } = useSystemSettings();
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultEnd = useMemo(() => {
    if (maxDateStr) return maxDateStr;
    const d = new Date();
    d.setMonth(d.getMonth() + (limitMonths || 3));
    return d.toISOString().slice(0, 10);
  }, [maxDateStr, limitMonths]);

  const [rangeStart, setRangeStart] = useState<string>(todayStr);
  const [rangeEnd, setRangeEnd] = useState<string>(defaultEnd);
  const [busyReserve, setBusyReserve] = useState(false);
  const [messageReserve, setMessageReserve] = useState('');

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
    <div className="rtw-root">
      <div className="rtw-grid">
        <section className="rtw-panel">
          <h3 className="rtw-h3">テンプレート一覧と編集</h3>
          <RecurringTemplatesManager isAdmin={isAdmin} currentUserId={currentUserId} roomOptions={roomOptions} />
        </section>

        <section className="rtw-panel">
          <h3 className="rtw-h3">テンプレートを実予約に適用</h3>
          <p className="rtw-help">保存済みテンプレートを期間指定で予約に展開します。既存予約は上書きしません。</p>
          <div className="rtw-form-row">
            <label htmlFor="rtw-start">開始日</label>
            <input
              id="rtw-start"
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </div>
          <div className="rtw-form-row">
            <label htmlFor="rtw-end">終了日</label>
            <input
              id="rtw-end"
              type="date"
              value={rangeEnd}
              max={maxDateStr || undefined}
              onChange={(e) => setRangeEnd(clampEnd(e.target.value))}
            />
          </div>
          <p className="rtw-note">最大予約日: {maxDateStr ? maxDateStr : '（未設定）'}</p>
          <button
            type="button"
            className="rtw-btn-primary"
            onClick={handleApplyReservations}
            disabled={!isAdmin || busyReserve}
          >
            {busyReserve ? '生成中…' : '予約を生成'}
          </button>
          {messageReserve && <div className="rtw-message">{messageReserve}</div>}
        </section>
      </div>

      <div className="rtw-grid rtw-grid--secondary">
        <section className="rtw-panel">
          <h3 className="rtw-h3">CSV一括予約</h3>
          <CsvBulkReservations currentUserId={currentUserId} roomOptions={roomOptions} isAdmin={isAdmin} />
        </section>

        <section className="rtw-panel">
          <h3 className="rtw-h3">期間指定の一括削除</h3>
          <BulkDeleteReservations roomOptions={roomOptions} isAdmin={isAdmin} />
        </section>
      </div>
    </div>
  );
}
