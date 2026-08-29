// 会議室予約削除・駐車場入場用パスコード入力モーダル
import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './PasscodeModal.css';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPasscode: string;
  roomName?: string;
  description?: React.ReactNode;
  submitLabel?: string;
  title?: string;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPasscode,
  roomName = '会議室',
  description,
  submitLabel = '認証して削除',
  title = 'パスコード認証'
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setPasscode('');
      setError('');
    }
  }, [isOpen]);

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

    await new Promise(resolve => setTimeout(resolve, 300));

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
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="passcode-modal-title"
      >
        <div className="passcode-modal-header">
          <h3 id="passcode-modal-title">{title}</h3>
          <button
            type="button"
            className="passcode-modal-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="passcode-modal-body">
          <p className="passcode-modal-description" id="passcode-modal-desc">
            {description ?? (
              <>
                <strong>{roomName}</strong>の予約を削除するには<br />
                パスコードを入力してください。
              </>
            )}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="passcode-input-wrapper">
              <input
                id="passcode-input"
                ref={inputRef}
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
                placeholder="英数字6桁"
                maxLength={6}
                disabled={loading}
                className={`passcode-input ${error ? 'has-error' : ''}`}
                autoComplete="off"
                aria-label="パスコード"
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'passcode-error' : 'passcode-modal-desc'}
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
                {loading ? '認証中...' : submitLabel}
              </button>
            </div>
          </form>

          <p className="passcode-hint">
            パスコードは管理者にお問い合わせください
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasscodeModal;
