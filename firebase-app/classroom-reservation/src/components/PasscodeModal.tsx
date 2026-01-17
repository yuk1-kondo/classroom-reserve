// 会議室予約削除用パスコード入力モーダル
import React, { useState, useEffect, useRef } from 'react';
import './PasscodeModal.css';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPasscode: string;
  roomName?: string;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPasscode,
  roomName = '会議室'
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // モーダルが開いたときに入力欄にフォーカス
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setPasscode('');
      setError('');
    }
  }, [isOpen]);

  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passcode.trim()) {
      setError('パスコードを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    // 少し遅延を入れて認証感を出す
    await new Promise(resolve => setTimeout(resolve, 300));

    // パスコード検証（大文字小文字を区別しない）
    if (passcode.toUpperCase() === correctPasscode.toUpperCase()) {
      setLoading(false);
      onSuccess();
    } else {
      setError('パスコードが正しくありません');
      setPasscode('');
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="passcode-modal-overlay" onClick={onClose}>
      <div 
        className="passcode-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="passcode-modal-title"
      >
        <div className="passcode-modal-header">
          <h3 id="passcode-modal-title">🔑 パスコード認証</h3>
          <button 
            className="passcode-modal-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="passcode-modal-body">
          <p className="passcode-modal-description">
            <strong>{roomName}</strong>の予約を削除するには<br />
            パスコードを入力してください。
          </p>

          <form onSubmit={handleSubmit}>
            <div className="passcode-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
                placeholder="パスコード（6桁）"
                maxLength={6}
                disabled={loading}
                className={`passcode-input ${error ? 'has-error' : ''}`}
                autoComplete="off"
                aria-describedby={error ? 'passcode-error' : undefined}
              />
            </div>

            {error && (
              <div id="passcode-error" className="passcode-error" role="alert">
                {error}
              </div>
            )}

            <div className="passcode-modal-actions">
              <button
                type="button"
                className="passcode-cancel-btn"
                onClick={onClose}
                disabled={loading}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="passcode-submit-btn"
                disabled={loading || passcode.length < 6}
              >
                {loading ? '認証中...' : '認証して削除'}
              </button>
            </div>
          </form>

          <p className="passcode-hint">
            ※ パスコードは管理者にお問い合わせください
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasscodeModal;
