import React, { useEffect, useState } from 'react';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { systemSettingsService } from '../../firebase/settings';
import { Timestamp } from 'firebase/firestore';
import { authService } from '../../firebase/auth';

interface Props {
  currentUserId?: string | null;
}

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ReservationLimitSettings: React.FC<Props> = ({ currentUserId }) => {
  const { loading, error, maxDate, maxDateStr } = useSystemSettings();
  const [absoluteDate, setAbsoluteDate] = useState<string>(maxDateStr || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const canWrite = authService.isAdmin();

  useEffect(() => {
    if (maxDateStr) setAbsoluteDate(maxDateStr);
  }, [maxDateStr]);

  // 今年の12/31ボタンは要件により削除（不要）

  const handleSave = async () => {
    if (!currentUserId || !canWrite) {
      alert('管理者メールでログインしてください（設定の保存には管理者権限が必要です）');
      return;
    }
    try {
      setSaving(true);
      if (!absoluteDate) {
        alert('固定日付を指定してください');
        return;
      }
      const [y, mo, d] = absoluteDate.split('-').map(v => parseInt(v, 10));
      const max = new Date(y, (mo - 1), d, 23, 59, 59, 999);

      await systemSettingsService.upsert({
        reservationMaxTimestamp: Timestamp.fromDate(max),
        updatedBy: currentUserId
      });
      setMessage('✅ 設定を保存しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      console.error(e);
      const msg = (e?.code === 'permission-denied')
        ? '❌ 権限エラー: 管理者メールでログインしてください'
        : '❌ 設定の保存に失敗しました';
      setMessage(msg);
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginTop: 12 }}>
      <h5 style={{ margin: 0, marginBottom: 8 }}>🛡️ 予約制限設定</h5>
      {loading && <div style={{ fontSize: 12, color: '#666' }}>設定を読み込み中…</div>}
      {error && <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>固定日付で制限</label>
        <input
          type="date"
          value={absoluteDate}
          onChange={(e) => setAbsoluteDate(e.target.value)}
          disabled={!canWrite || saving}
          aria-label="固定締切日"
        />
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#374151' }}>
        <div>現在の適用上限: <strong>{maxDate ? fmt(maxDate) : '未設定'}</strong></div>
        <div>今回の保存内容プレビュー: <strong>{absoluteDate || '—'}</strong></div>
        <div style={{ color: '#6b7280' }}>保存すると UI と ルール（予約作成の startTime）に即時反映されます。</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={handleSave} disabled={saving || !canWrite}>
          {saving ? '保存中…' : '保存'}
        </button>
        {!canWrite && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            設定の変更には管理者メールでのログインが必要です。
          </div>
        )}
        {message && <div style={{ fontSize: 12 }}>{message}</div>}
      </div>
    </div>
  );
};

export default ReservationLimitSettings;
