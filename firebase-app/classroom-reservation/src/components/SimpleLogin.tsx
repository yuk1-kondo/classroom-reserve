import React, { useState } from 'react';
import { authService } from '../firebase/auth';
import './SimpleLogin.css';

interface SimpleLoginProps {
  onAuthStateChange: () => void;
}

const SimpleLogin: React.FC<SimpleLoginProps> = ({ onAuthStateChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await authService.signInWithGoogle();
      onAuthStateChange();
    } catch (error: any) {
      console.error('Googleログインエラー:', error);
      // ドメイン制限エラーメッセージを優先表示
      if (error.message && error.message.includes(authService.getAllowedDomain())) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Googleログインに失敗しました');
      }
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

  return (
    <div className="simple-login-overlay">
      <div className="simple-login-modal">
        <div className="simple-login-header">
          <h2>桜和高校教室予約システム</h2>
          <button 
            className="close-button"
            onClick={() => {/* クローズボタンの処理は親コンポーネントで */}}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>
        
        <div className="simple-login-body">
          <div className="login-description">
            <p>ログインしてください</p>
            <p className="domain-restriction">
              📧 すべてのGoogleアカウントでご利用いただけます
            </p>
          </div>

          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}

          <div className="login-methods">
            {/* Googleログイン */}
            <div className="login-method">
              <h3>教師ログイン</h3>
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="google-login-btn"
              >
                {isLoading ? 'ログイン中...' : 'Googleアカウントでログイン'}
              </button>
            </div>

            {/* 管理者ログイン */}
            <div className="login-method">
              <h3>管理者ログイン</h3>
              <div className="admin-login">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="管理者パスワード"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAdminLogin();
                    }
                  }}
                  disabled={isLoading}
                />
                <button 
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                  className="admin-login-btn"
                >
                  {isLoading ? 'ログイン中...' : 'ログイン'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleLogin;
