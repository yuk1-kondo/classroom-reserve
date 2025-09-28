import React, { useEffect, useState } from 'react';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { systemSettingsService } from '../../firebase/settings';
import { Timestamp } from 'firebase/firestore';
import { authService } from '../../firebase/auth';
import { useAuth } from '../../hooks/useAuth';

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
  // 仕様: 追加登録した管理者も予約制限設定は変更可能（スーパー限定ではない）
  const { isAdmin } = useAuth();
  const canWrite = isAdmin;

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
    <div className="admin-card rls-card">
      <h5 className="rls-title">🛡️ 予約制限設定</h5>
      {loading && <div className="rls-loading">設定を読み込み中…</div>}
      {error && <div className="rls-error">{error}</div>}

      <div className="rls-row">
        <label className="rls-label">固定日付で制限</label>
        <input
          type="date"
          value={absoluteDate}
          onChange={(e) => setAbsoluteDate(e.target.value)}
          disabled={!canWrite || saving}
          aria-label="固定締切日"
        />
      </div>

      <div className="rls-info">
        <div>現在の適用上限: <strong>{maxDate ? fmt(maxDate) : '未設定'}</strong></div>
        <div>今回の保存内容プレビュー: <strong>{absoluteDate || '—'}</strong></div>
        <div className="rls-hint">保存すると UI と ルール（予約作成の startTime）に即時反映されます。</div>
      </div>

      <div className="rls-actions">
        <button type="button" onClick={handleSave} disabled={saving || !canWrite}>
          {saving ? '保存中…' : '保存'}
        </button>
        {!canWrite && (
          <div className="rls-note">
            設定の変更には管理者メールでのログインが必要です。
          </div>
        )}
        {message && <div className="rls-msg">{message}</div>}
      </div>
    </div>
  );
};

export default ReservationLimitSettings;
