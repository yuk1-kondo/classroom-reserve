import React, { useEffect, useState } from 'react';
import { systemSettingsService } from '../../firebase/settings';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  currentUserId?: string | null;
}

export const PasscodeSettings: React.FC<Props> = ({ currentUserId }) => {
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
    <div className="admin-card rls-card">
      <h5 className="rls-title">🔑 会議室削除パスコード設定</h5>
      {loading && <div className="rls-loading">設定を読み込み中…</div>}

      <div className="rls-info" style={{ marginBottom: '12px' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>
          進路指導部の先生に会議室の予約削除権限を与えるためのパスコードです。<br />
          このパスコードを知っている人は、他の人が作成した会議室の予約を削除できます。
        </p>
      </div>

      <div className="rls-row">
        <label className="rls-label">現在のパスコード</label>
        <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
          {showPasscode ? (currentPasscode || '未設定') : maskedPasscode}
        </span>
        {currentPasscode && (
          <button 
            type="button" 
            onClick={() => setShowPasscode(!showPasscode)}
            style={{ 
              marginLeft: '8px', 
              padding: '2px 8px', 
              fontSize: '12px',
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showPasscode ? '隠す' : '表示'}
          </button>
        )}
      </div>

      <div className="rls-row" style={{ marginTop: '12px' }}>
        <label className="rls-label">新しいパスコード</label>
        <input
          type="text"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          placeholder="英数字6桁"
          maxLength={6}
          disabled={!canWrite || saving}
          style={{ 
            fontFamily: 'monospace', 
            fontSize: '14px',
            width: '120px',
            textTransform: 'uppercase'
          }}
        />
        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>
          {passcode.length}/6文字
        </span>
      </div>

      <div className="rls-hint" style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
        ※ 英数字6桁で設定してください（例: ABC123）
      </div>

      <div className="rls-actions" style={{ marginTop: '16px' }}>
        <button 
          type="button" 
          onClick={handleSave} 
          disabled={saving || !canWrite || !validatePasscode(passcode)}
        >
          {saving ? '保存中…' : '保存'}
        </button>
        {currentPasscode && (
          <button 
            type="button" 
            onClick={handleClear} 
            disabled={saving || !canWrite}
            style={{ 
              marginLeft: '8px',
              background: '#dc3545',
              color: 'white'
            }}
          >
            削除
          </button>
        )}
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

export default PasscodeSettings;
