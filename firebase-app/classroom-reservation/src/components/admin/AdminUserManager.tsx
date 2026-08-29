// 管理者権限管理コンポーネント
import React, { useState, useEffect } from 'react';
import { adminService, AdminUser, SUPER_ADMIN_EMAIL } from '../../firebase/admin';
import { useAuth } from '../../hooks/useAuth';
import './AdminUserManager.css';

export const AdminUserManager: React.FC = () => {
  const { currentUser, isAdmin, isSuperAdmin, refreshAdminStatus } = useAuth();
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // const [isFirstAdmin, setIsFirstAdmin] = useState(false); // 互換保持のみ（UI制御には未使用）
  const [superAdminUid, setSuperAdminUid] = useState<string | null>(null);

  // 管理者リストを読み込み
  const loadAdminUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📋 管理者リスト読み込み開始');
      
      const users = await adminService.getAdminUsers();
      setAdminUsers(users);

      // スーパー管理者UIDの逆引き（メール→UID）
      try {
        const suid = await adminService.getUidByEmail(SUPER_ADMIN_EMAIL);
        if (suid) setSuperAdminUid(suid);
      } catch {}
      
      console.log('📋 管理者リスト読み込み完了:', users.length, '件');
    } catch (error) {
      console.error('❌ 管理者リスト読み込みエラー:', error);
      setError('管理者リストの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 管理者を追加
  const addAdmin = async () => {
    if (!newAdminEmail || !currentUser) {
      setError('メールアドレスを入力してください');
      return;
    }

    // 最初の管理者のみが管理者を追加できる
    if (!isSuperAdmin) {
      setError('管理者の追加は最初の管理者（スーパー管理者）のみが行えます');
      return;
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAdminEmail)) {
      setError('正しいメールアドレスを入力してください');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('➕ 管理者追加開始:', newAdminEmail);
      
      // 新しい仕組み: メールアドレスを入力してもらい、そのユーザーにログインしてもらってUIDを取得
      // まず、そのメールアドレスでログインしたユーザーがいるかチェック
      const existingUid = await adminService.getUidByEmail(newAdminEmail);
      
      if (!existingUid) {
        setError('このメールアドレスでログインしたユーザーが見つかりません。まずそのユーザーにGoogleログインしてもらってください。');
        return;
      }
      
      await adminService.addAdmin(existingUid, newAdminEmail, currentUser.uid);
      
      setNewAdminEmail('');
      setSuccess('管理者を追加しました');
      
      // 管理者リストを再読み込み
      await loadAdminUsers();
      
      // 管理者権限を再チェック（現在のユーザーが自分自身を追加した場合）
      if (existingUid === currentUser.uid) {
        await refreshAdminStatus();
      }
      
      console.log('✅ 管理者追加完了');
    } catch (error: any) {
      console.error('❌ 管理者追加エラー:', error);
      setError(error.message || '管理者の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  const formatAssignedAt = (value: any): string => {
    try {
      if (!value) return '不明';
      if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return d.toLocaleDateString('ja-JP');
      }
      // Firestore Timestamp 風 { seconds, nanoseconds }
      if (typeof value.seconds === 'number') {
        const d = new Date(value.seconds * 1000);
        return d.toLocaleDateString('ja-JP');
      }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '不明';
      return d.toLocaleDateString('ja-JP');
    } catch {
      return '不明';
    }
  };

  // 管理者を削除
  const removeAdmin = async (uid: string, email: string) => {
    // スーパー管理者のみが管理者を削除できる
    if (!isSuperAdmin) {
      setError('管理者の削除は最初の管理者のみが行えます');
      return;
    }

    // スーパー管理者は削除不可（自己保護）
    if (email === SUPER_ADMIN_EMAIL) {
      setError('初期管理者は削除できません');
      return;
    }

    if (!window.confirm(`「${email}」の管理者権限を削除しますか？`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('➖ 管理者削除開始:', uid);
      
      await adminService.removeAdmin(uid);
      
      setSuccess('管理者権限を削除しました');
      
      // 管理者リストを再読み込み
      await loadAdminUsers();
      
      // 管理者権限を再チェック（現在のユーザーが自分自身を削除した場合）
      if (uid === currentUser?.uid) {
        await refreshAdminStatus();
      }
      
      console.log('✅ 管理者削除完了');
    } catch (error: any) {
      console.error('❌ 管理者削除エラー:', error);
      setError(error.message || '管理者権限の削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // エラーメッセージをクリア
  const clearError = () => {
    setError(null);
  };

  // 成功メッセージをクリア
  const clearSuccess = () => {
    setSuccess(null);
  };

  // コンポーネントマウント時に管理者リストを読み込み
  useEffect(() => {
    if (isAdmin) {
      loadAdminUsers();
    }
  }, [isAdmin]);

  // isFirstAdmin は互換保持のみ（UIは isSuperAdmin で制御）

  // 管理者権限がない場合はアクセス拒否
  if (!isAdmin) {
    return (
      <div className="admin-user-manager">
        <div className="access-denied">
          <h3>🔒 アクセス拒否</h3>
          <p>この機能を使用するには管理者権限が必要です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-user-manager">
      <div className="admin-header">
        <h3>👑 管理者権限管理</h3>
        <p>システムの管理者権限を管理できます。</p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
          <button onClick={clearError} className="close-btn">×</button>
        </div>
      )}

      {/* 成功メッセージ */}
      {success && (
        <div className="success-message">
          <span>✅ {success}</span>
          <button onClick={clearSuccess} className="close-btn">×</button>
        </div>
      )}

      {/* 管理者追加セクション（スーパー管理者のみ） */}
      {isSuperAdmin && (
        <div className="add-admin-section">
          <h4>新しい管理者を追加</h4>
          <div className="add-admin-form">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="管理者に追加するメールアドレス"
              disabled={loading}
              className="email-input"
            />
            <button 
              onClick={addAdmin}
              disabled={loading || !newAdminEmail}
              className="add-admin-btn"
            >
              {loading ? '処理中...' : '管理者に追加'}
            </button>
          </div>
          <p className="form-note">
            ※ 管理者に追加するユーザーは、まずGoogleログインしてから管理者追加を行ってください
          </p>
        </div>
      )}

      {/* 管理者リスト */}
      <div className="admin-list-section">
        <h4>現在の管理者一覧</h4>
        {loading ? (
          <div className="loading-message">
            <span>読み込み中...</span>
          </div>
        ) : adminUsers.length === 0 ? (
          <div className="empty-message">
            <span>管理者が登録されていません</span>
          </div>
        ) : (
          <div className="admin-list">
            {adminUsers.map((user) => (
              <div key={user.uid} className="admin-user-item">
                <div className="admin-user-info">
                  <span className="admin-email">{user.email}</span>
                  <span className="admin-uid">ID: {user.uid}</span>
                  <span className="admin-assigned-date">追加日: {formatAssignedAt(user.assignedAt)}</span>
                </div>
                {(isSuperAdmin && user.tier !== 'super' && user.email !== SUPER_ADMIN_EMAIL && user.uid !== superAdminUid) && (
                  <button 
                    onClick={() => removeAdmin(user.uid, user.email)}
                    className="remove-admin-btn"
                    disabled={loading}
                    title="管理者権限を削除"
                  >
                    削除
                  </button>
                )}
                {(!isSuperAdmin || user.tier === 'super' || user.email === SUPER_ADMIN_EMAIL || user.uid === superAdminUid) && (
                  <span className="no-permission-text">削除不可</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 統計情報 */}
      <div className="admin-stats">
        <p>📊 管理者数: {adminUsers.length}人</p>
        {currentUser && (
          <p>👤 現在のユーザー: {currentUser.email}</p>
        )}
      </div>
    </div>
  );
};

export default AdminUserManager;
