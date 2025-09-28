// 認証管理用カスタムフック
import { useState, useEffect } from 'react';
import { authService, AuthUser } from '../firebase/auth';
import { adminService } from '../firebase/admin';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 管理者権限をチェック
  const checkAdminStatus = async (user: AuthUser | null) => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 管理者権限チェック開始:', user.uid);
      const adminStatus = await adminService.isAdmin(user.uid, user.email);
      setIsAdmin(adminStatus);
      console.log('🔍 管理者権限チェック結果:', adminStatus);

      // スーパー管理者（最初の管理者 or tier=super）チェック
      let superStatus = false;
      if (adminStatus) {
        try {
          superStatus = await adminService.isSuperAdmin(user.uid, user.email);
        } catch (e) {
          console.error('❌ スーパー管理者権限チェックエラー:', e);
          superStatus = false;
        }
      }
      setIsSuperAdmin(superStatus);
    } catch (error) {
      console.error('❌ 管理者権限チェックエラー:', error);
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  // 認証状態の変化を監視
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      console.log('認証状態変更:', user);
      
      // 管理者権限をチェック
      await checkAdminStatus(user);
    });

    return () => unsubscribe();
  }, []);

  // ログイン処理
  const handleLoginSuccess = async () => {
    const user = authService.getCurrentUserExtended();
    setCurrentUser(user);
    console.log('ログイン成功:', user);
    setShowLoginModal(false);
    
    // 管理者権限をチェック
    await checkAdminStatus(user);
    
    return user;
  };

  // ログアウト処理
  const handleLogout = () => {
    authService.simpleLogout();
    setCurrentUser(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setLoading(false);
    console.log('ログアウト成功');
  };

  // 管理者権限を手動で再チェック
  const refreshAdminStatus = async () => {
    if (currentUser) {
      await checkAdminStatus(currentUser);
    }
  };

  return {
    currentUser,
    isAdmin,
    isSuperAdmin,
    loading,
    showLoginModal,
    setShowLoginModal,
    handleLoginSuccess,
    handleLogout,
    refreshAdminStatus
  };
};
