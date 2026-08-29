import React, { useRef, useState } from 'react';
import { authService } from '../firebase/auth';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './SimpleLogin.css';

function formatGoogleLoginError(error: any): string {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code === 'auth/unauthorized-domain') {
    return 'このURLではGoogleログインできません。アドレス欄を http://localhost:3000 にして開き直してください（127.0.0.1 では失敗します）。';
  }
  if (code === 'auth/popup-blocked') {
    return 'ポップアップがブロックされました。ブラウザでポップアップを許可して、もう一度お試しください。';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'ログインがキャンセルされました。もう一度お試しください。';
  }
  if (code === 'auth/network-request-failed') {
    return 'ネットワークエラーです。接続を確認してもう一度お試しください。';
  }
  if (message.includes(authService.getAllowedDomain()) || message.includes('ブロック')) {
    return message;
  }
  return `ログインに失敗しました${code ? `（${code}）` : ''}`;
}

interface SimpleLoginProps {
  onAuthStateChange: () => void;
  /** overlay: 全画面。embedded: 親モーダル内。page: ページ中央カード */
  variant?: 'overlay' | 'embedded' | 'page';
}

const SimpleLogin: React.FC<SimpleLoginProps> = ({
  onAuthStateChange,
  variant = 'overlay'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(variant !== 'page', dialogRef);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await authService.signInWithGoogle();
      onAuthStateChange();
    } catch (error: any) {
      console.error('Googleログインエラー:', error);
      setErrorMessage(formatGoogleLoginError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) {
      setErrorMessage('パスワードを入力してください');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const success = await authService.signInAsAdmin(adminPassword);
      if (success) {
        onAuthStateChange();
        setAdminPassword('');
      } else {
        setErrorMessage('パスワードが正しくありません');
      }
    } catch (error) {
      console.error('管理者ログインエラー:', error);
      setErrorMessage('ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const card = (
    <div
      className="simple-login-modal"
      ref={dialogRef}
      role={variant === 'page' ? 'region' : 'dialog'}
      aria-modal={variant === 'page' ? undefined : true}
      aria-labelledby="simple-login-title"
    >
      <div className="simple-login-header">
        <h2 id="simple-login-title">ログイン</h2>
        <p className="simple-login-lead">桜和高校教室予約システム</p>
      </div>

      <div className="simple-login-body">
        {errorMessage && (
          <div className="error-message" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="login-method">
          <h3>Googleアカウント</h3>
          <p className="domain-restriction">
            {authService.getAllowedDomain()} のアカウントでログインできます。
          </p>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="google-login-btn"
          >
            {isLoading ? 'ログイン中...' : 'Googleアカウントでログイン'}
          </button>
        </section>

        <section className="login-method">
          <h3>管理者の方</h3>
          <div className="admin-login">
            <label htmlFor="admin-password" className="visually-hidden">
              管理者パスワード
            </label>
            <input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAdminLogin();
                }
              }}
              placeholder="管理者パスワード"
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={handleAdminLogin}
              disabled={isLoading}
              className="admin-login-btn"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );

  if (variant === 'embedded' || variant === 'page') {
    return card;
  }

  return <div className="simple-login-overlay">{card}</div>;
};

export default SimpleLogin;
