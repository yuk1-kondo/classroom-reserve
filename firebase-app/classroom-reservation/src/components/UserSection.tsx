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
          <div className="user-avatar">
            {currentUser.role === 'admin' ? '👩‍💼' : 
             currentUser.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
          </div>
          <div className="user-details">
            <div className="user-name">{currentUser.displayName || currentUser.name}</div>
            <div className="user-role">
              {currentUser.role === 'admin' ? '管理者' : 
               currentUser.role === 'teacher' ? '教師' : '学生'}
            </div>
          </div>
          <button 
            className="logout-button"
            onClick={onLogout}
            title="ログアウト"
          >
            🚪
          </button>
        </div>
      ) : (
        <div className="login-prompt">
          <div className="login-message">予約を作成するにはログインしてください</div>
          <button 
            className="login-button"
            onClick={onLogin}
          >
            👤 ログイン
          </button>
        </div>
      )}
    </div>
  );
};
