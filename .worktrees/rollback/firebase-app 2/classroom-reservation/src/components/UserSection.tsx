// ユーザー情報セクションコンポーネント
import React from 'react';
import { AuthUser } from '../firebase/auth';

interface UserSectionProps {
  currentUser: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const UserSection: React.FC<UserSectionProps> = ({
  currentUser,
  onLogin,
  onLogout
}) => {
  return (
    <div className="user-info-section">
      {currentUser ? (
        <div className="current-user-info">
          <div className="user-details">
            <div className="user-name">ログインしているユーザー：{currentUser.displayName || currentUser.name}</div>
          </div>
          <button 
            className="logout-button"
            onClick={onLogout}
            title="ログアウト"
          >
            ログアウト
          </button>
        </div>
      ) : (
        <div className="login-prompt">
          <div className="login-message">予約を作成するにはログインしてください</div>
          <button 
            className="login-button"
            onClick={onLogin}
          >
            ログイン
          </button>
        </div>
      )}
    </div>
  );
};
