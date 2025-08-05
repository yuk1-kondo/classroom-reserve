// 認証管理用カスタムフック
import { useState, useEffect } from 'react';
import { authService, AuthUser } from '../firebase/auth';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 初期化時に現在のユーザーを取得
  useEffect(() => {
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
  }, []);

  // ログイン処理
  const handleLoginSuccess = () => {
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
    console.log('ログイン成功:', user);
    setShowLoginModal(false);
    return user;
  };

  // ログアウト処理
  const handleLogout = () => {
    authService.simpleLogout();
    setCurrentUser(null);
    console.log('ログアウト成功');
  };

  return {
    currentUser,
    showLoginModal,
    setShowLoginModal,
    handleLoginSuccess,
    handleLogout
  };
};
