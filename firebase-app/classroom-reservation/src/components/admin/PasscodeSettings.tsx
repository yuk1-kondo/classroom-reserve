import React, { useEffect, useState } from 'react';
import { systemSettingsService } from '../../firebase/settings';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  currentUserId?: string | null;
  hideTitle?: boolean;
}

export const PasscodeSettings: React.FC<Props> = ({ currentUserId, hideTitle }) => {
  const [passcode, setPasscode] = useState<string>('');
  const [currentPasscode, setCurrentPasscode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [showPasscode, setShowPasscode] = useState(false);
  const { isAdmin } = useAuth();
  const canWrite = isAdmin;

  // 現在のパスコードを取得
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const settings = await systemSettingsService.get();
        if (!mounted) return;
        setCurrentPasscode(settings?.meetingRoomDeletePasscode || null);
        setPasscode(settings?.meetingRoomDeletePasscode || '');
      } catch (e) {
        console.error('パスコード取得エラー:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // パスコードのバリデーション（英数字6桁）
  const validatePasscode = (value: string): boolean => {
    return /^[a-zA-Z0-9]{6}$/.test(value);
  };

  const handleSave = async () => {
    if (!currentUserId || !canWrite) {
      alert('管理者メールでログインしてください');
      return;
    }

    if (!passcode.trim()) {
      setMessage('❌ パスコードを入力してください');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!validatePasscode(passcode)) {
      setMessage('❌ パスコードは英数字6桁で入力してください');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setSaving(true);
      await systemSettingsService.upsert({
        meetingRoomDeletePasscode: passcode,
        updatedBy: currentUserId
      });
      setCurrentPasscode(passcode);
      setMessage('✅ パスコードを保存しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      console.error('パスコード保存エラー:', e);
      const msg = (e?.code === 'permission-denied')
        ? '❌ 権限エラー: 管理者メールでログインしてください'
        : '❌ パスコードの保存に失敗しました';
      setMessage(msg);
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!currentUserId || !canWrite) {
      alert('管理者メールでログインしてください');
      return;
    }

    if (!window.confirm('パスコードを削除しますか？\n削除すると、進路指導部の先生は会議室の予約を削除できなくなります。')) {
      return;
    }

    try {
      setSaving(true);
      await systemSettingsService.upsert({
        meetingRoomDeletePasscode: '',
        updatedBy: currentUserId
      });
      setCurrentPasscode(null);
      setPasscode('');
      setMessage('✅ パスコードを削除しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      console.error('パスコード削除エラー:', e);
      setMessage('❌ パスコードの削除に失敗しました');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  // パスコードをマスク表示
  const maskedPasscode = currentPasscode ? '●'.repeat(currentPasscode.length) : '未設定';

  return (
    <div className="admin-settings-block">
      {!hideTitle && <h5 className="admin-settings-block__title">会議室削除パスコード設定</h5>}
      {loading && <div className="admin-settings-block__loading">設定を読み込み中…</div>}

      <div className="admin-settings-block__info admin-settings-block__info--compact">
        <p className="admin-settings-block__text">
          進路指導部の先生に会議室の予約削除権限を与えるためのパスコードです。<br />
          このパスコードを知っている人は、他の人が作成した会議室の予約を削除できます。
        </p>
      </div>

      <div className="admin-settings-block__row">
        <label className="admin-settings-block__label">現在のパスコード</label>
        <span className="admin-settings-block__mono">
          {showPasscode ? (currentPasscode || '未設定') : maskedPasscode}
        </span>
        {currentPasscode && (
          <button
            type="button"
            className="admin-settings-block__btn admin-settings-block__btn--small admin-settings-block__btn--offset"
            onClick={() => setShowPasscode(!showPasscode)}
          >
            {showPasscode ? '隠す' : '表示'}
          </button>
        )}
      </div>

      <div className="admin-settings-block__row admin-settings-block__row--spaced">
        <label className="admin-settings-block__label">新しいパスコード</label>
        <input
          type="text"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          placeholder="英数字6桁"
          maxLength={6}
          disabled={!canWrite || saving}
          className="admin-settings-block__field admin-settings-block__field--mono"
        />
        <span className="admin-settings-block__counter">
          {passcode.length}/6文字
        </span>
      </div>

      <div className="admin-settings-block__hint admin-settings-block__hint--spaced">
        ※ 英数字6桁で設定してください（例: ABC123）
      </div>

      <div className="admin-settings-block__actions admin-settings-block__actions--spaced">
        <button
          type="button"
          className="admin-settings-block__btn admin-settings-block__btn--primary"
          onClick={handleSave}
          disabled={saving || !canWrite || !validatePasscode(passcode)}
        >
          {saving ? '保存中…' : '保存'}
        </button>
        {currentPasscode && (
          <button
            type="button"
            className="admin-settings-block__btn admin-settings-block__btn--danger"
            onClick={handleClear}
            disabled={saving || !canWrite}
          >
            削除
          </button>
        )}
        {!canWrite && (
          <div className="admin-settings-block__note">
            設定の変更には管理者メールでのログインが必要です。
          </div>
        )}
        {message && <div className="admin-settings-block__msg">{message}</div>}
      </div>
    </div>
  );
};

export default PasscodeSettings;
