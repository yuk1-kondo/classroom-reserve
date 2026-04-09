import React, { useState, useEffect, useMemo } from 'react';
import { userAccessService, UserAccessRecord, UserStatus } from '../../firebase/userAccess';
import { adminService, SUPER_ADMIN_EMAIL } from '../../firebase/admin';
import { guidancePrivilegeService } from '../../firebase/guidancePrivilege';
import { useAuth } from '../../hooks/useAuth';
import './UserAccessManager.css';

type FilterMode = 'all' | 'allowed' | 'blocked' | 'admin';

interface UserRow extends UserAccessRecord {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isGuidanceMember: boolean;
}

interface UserAccessManagerProps {
  /** 左ナビで見出しを出す場合、カード内の重複見出しを隠す */
  hideTitle?: boolean;
}

export const UserAccessManager: React.FC<UserAccessManagerProps> = ({ hideTitle }) => {
  const { currentUser, isAdmin, isSuperAdmin, refreshAdminStatus } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const [accessList, adminList, guidanceList] = await Promise.all([
        userAccessService.getAllUsers(),
        adminService.getAdminUsers(),
        guidancePrivilegeService.listMembers()
      ]);

      const adminUids = new Set(adminList.map(a => a.uid));
      const superUids = new Set(
        adminList.filter(a => a.tier === 'super' || a.email === SUPER_ADMIN_EMAIL).map(a => a.uid)
      );
      const guidanceUids = new Set(guidanceList.map(g => g.uid));

      const rows: UserRow[] = accessList.map(u => ({
        ...u,
        isAdmin: adminUids.has(u.uid),
        isSuperAdmin: superUids.has(u.uid),
        isGuidanceMember: guidanceUids.has(u.uid)
      }));

      setUsers(rows);
    } catch (e: any) {
      setError('ユーザー一覧の取得に失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const added = await userAccessService.syncFromUserProfiles();
      if (added > 0) {
        setSuccess(`過去のログインユーザー ${added}件 を取り込みました`);
      } else {
        setSuccess('新規ユーザーはありません（全て同期済み）');
      }
      await loadUsers();
    } catch (e: any) {
      setError('同期に失敗しました: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // 初回マウント時: user_profiles → user_access の自動同期 + ロード
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        setLoading(true);
        await userAccessService.syncFromUserProfiles();
      } catch {}
      await loadUsers();
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = users;
    if (filter === 'allowed') list = list.filter(u => u.status === 'allowed');
    if (filter === 'blocked') list = list.filter(u => u.status === 'blocked');
    if (filter === 'admin') list = list.filter(u => u.isAdmin);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u =>
        (u.email?.toLowerCase().includes(q)) ||
        (u.displayName?.toLowerCase().includes(q)) ||
        u.uid.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filter, search]);

  const handleStatusChange = async (uid: string, email: string, newStatus: UserStatus) => {
    const label = newStatus === 'blocked' ? 'ブロック' : '許可';
    if (!window.confirm(`${email} を「${label}」に変更しますか？`)) return;
    try {
      setError(null);
      setSuccess(null);
      await userAccessService.updateUserStatus(uid, newStatus);
      setSuccess(`${email} を ${label} に変更しました`);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || 'ステータス変更に失敗しました');
    }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!window.confirm(`${email} のユーザーレコードを削除しますか？\n（管理者権限がある場合はそちらも削除されます）`)) return;
    try {
      setError(null);
      setSuccess(null);
      // 管理者なら先に admin を削除
      const row = users.find(u => u.uid === uid);
      if (row?.isAdmin && !row.isSuperAdmin) {
        try { await adminService.removeAdmin(uid); } catch {}
      }
      await userAccessService.deleteUser(uid, currentUser?.uid ?? null);
      setSuccess(`${email} を削除しました`);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || 'ユーザー削除に失敗しました');
    }
  };

  const handleAdminToggle = async (uid: string, email: string, currentlyAdmin: boolean) => {
    try {
      setError(null);
      setSuccess(null);
      if (currentlyAdmin) {
        if (!window.confirm(`${email} の管理者権限を削除しますか？`)) return;
        await adminService.removeAdmin(uid);
        setSuccess(`${email} の管理者権限を削除しました`);
      } else {
        if (!window.confirm(`${email} を管理者に追加しますか？`)) return;
        await adminService.addAdmin(uid, email, currentUser?.uid || 'unknown');
        setSuccess(`${email} を管理者に追加しました`);
      }
      if (uid === currentUser?.uid) await refreshAdminStatus();
      await loadUsers();
    } catch (e: any) {
      setError(e.message || '管理者権限の変更に失敗しました');
    }
  };

  const handleGuidanceToggle = async (uid: string, email: string, currentlyMember: boolean) => {
    const label = currentlyMember ? '進路グループから解除' : '進路グループに追加';
    if (!window.confirm(`${email} を「${label}」しますか？`)) return;
    try {
      setError(null);
      setSuccess(null);
      if (currentlyMember) {
        await guidancePrivilegeService.removeMember(uid);
        setSuccess(`${email} を進路グループから解除しました`);
      } else {
        await guidancePrivilegeService.addMember(uid, currentUser?.uid || 'unknown');
        setSuccess(`${email} を進路グループに追加しました`);
      }
      await loadUsers();
    } catch (e: any) {
      setError(e.message || '進路グループの変更に失敗しました');
    }
  };

  const formatDate = (ts: any): string => {
    try {
      if (!ts) return '-';
      const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts.seconds * 1000);
      return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } catch { return '-'; }
  };

  if (!isAdmin) {
    return (
      <div className="user-access-manager">
        <div className="access-denied">
          <h3>アクセス拒否</h3>
          <p>この機能を使用するには管理者権限が必要です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-access-manager">
      <div className="uam-header">
        {!hideTitle && <h3>ユーザー管理</h3>}
        <p>ログイン済みユーザーの一覧管理・アクセス制御・管理者権限の付与</p>
      </div>

      {error && (
        <div className="uam-error">
          <span>{error}</span>
          <button className="uam-close-btn" onClick={() => setError(null)}>x</button>
        </div>
      )}
      {success && (
        <div className="uam-success">
          <span>{success}</span>
          <button className="uam-close-btn" onClick={() => setSuccess(null)}>x</button>
        </div>
      )}

      <div className="uam-toolbar">
        <input
          className="uam-search"
          type="text"
          placeholder="メール / 名前 / UID で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="uam-filter" value={filter} onChange={e => setFilter(e.target.value as FilterMode)}>
          <option value="all">すべて</option>
          <option value="allowed">許可のみ</option>
          <option value="blocked">ブロックのみ</option>
          <option value="admin">管理者のみ</option>
        </select>
        <button className="uam-refresh-btn" onClick={loadUsers} disabled={loading}>
          {loading ? '読み込み中...' : '更新'}
        </button>
        {isSuperAdmin && (
          <button className="uam-refresh-btn" onClick={handleSync} disabled={loading}
            title="user_profiles から未登録ユーザーを取り込みます">
            {loading ? '同期中...' : '過去ユーザー同期'}
          </button>
        )}
      </div>

      <div className="uam-table-wrapper">
        <table className="uam-table">
          <thead>
            <tr>
              <th>ユーザー</th>
              <th>ステータス</th>
              <th>権限</th>
              {isSuperAdmin && <th>進路</th>}
              <th>最終ログイン</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isSuperAdmin ? 6 : 5} className="uam-loading">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={isSuperAdmin ? 6 : 5} className="uam-empty">該当するユーザーがいません</td></tr>
            ) : filtered.map(user => {
              const isSelf = user.uid === currentUser?.uid;
              const isSuperTarget = user.isSuperAdmin || user.email === SUPER_ADMIN_EMAIL;
              return (
                <tr key={user.uid}>
                  <td>
                    <div className="uam-email">{user.email}{isSelf ? ' (自分)' : ''}</div>
                    <div className="uam-name">{user.displayName || '-'}</div>
                  </td>
                  <td>
                    <span className={`uam-badge ${user.status === 'allowed' ? 'uam-badge-allowed' : 'uam-badge-blocked'}`}>
                      {user.status === 'allowed' ? '許可' : 'ブロック'}
                    </span>
                  </td>
                  <td>
                    {user.isSuperAdmin ? (
                      <span className="uam-badge uam-badge-super">Super Admin</span>
                    ) : user.isAdmin ? (
                      <span className="uam-badge uam-badge-admin">Admin</span>
                    ) : (
                      <span className="uam-badge uam-badge-teacher">Teacher</span>
                    )}
                  </td>
                  {isSuperAdmin && (
                    <td>
                      {user.isGuidanceMember ? (
                        <span className="uam-badge uam-badge-guidance">進路</span>
                      ) : (
                        <span className="uam-badge uam-badge-none">-</span>
                      )}
                    </td>
                  )}
                  <td><span className="uam-date">{formatDate(user.lastSeenAt)}</span></td>
                  <td>
                    <div className="uam-actions">
                      {/* ステータス切替 */}
                      {isSuperAdmin && !isSelf && !isSuperTarget && (
                        user.status === 'allowed' ? (
                          <button className="uam-btn uam-btn-block" disabled={loading}
                            onClick={() => handleStatusChange(user.uid, user.email, 'blocked')}>
                            ブロック
                          </button>
                        ) : (
                          <button className="uam-btn uam-btn-allow" disabled={loading}
                            onClick={() => handleStatusChange(user.uid, user.email, 'allowed')}>
                            許可
                          </button>
                        )
                      )}
                      {/* 管理者権限トグル */}
                      {isSuperAdmin && !isSelf && !isSuperTarget && (
                        user.isAdmin ? (
                          <button className="uam-btn uam-btn-admin-remove" disabled={loading}
                            onClick={() => handleAdminToggle(user.uid, user.email, true)}>
                            Admin解除
                          </button>
                        ) : (
                          <button className="uam-btn uam-btn-admin-add" disabled={loading}
                            onClick={() => handleAdminToggle(user.uid, user.email, false)}>
                            Admin付与
                          </button>
                        )
                      )}
                      {/* 進路グループ */}
                      {isSuperAdmin && !isSelf && !isSuperTarget && (
                        user.isGuidanceMember ? (
                          <button className="uam-btn uam-btn-guidance-remove" disabled={loading}
                            onClick={() => handleGuidanceToggle(user.uid, user.email, true)}>
                            進路解除
                          </button>
                        ) : (
                          <button className="uam-btn uam-btn-guidance-add" disabled={loading}
                            onClick={() => handleGuidanceToggle(user.uid, user.email, false)}>
                            進路追加
                          </button>
                        )
                      )}
                      {/* 削除 */}
                      {isSuperAdmin && !isSelf && !isSuperTarget && (
                        <button className="uam-btn uam-btn-delete" disabled={loading}
                          onClick={() => handleDelete(user.uid, user.email)}>
                          削除
                        </button>
                      )}
                      {(isSelf || isSuperTarget) && !isSuperAdmin && (
                        <span style={{ fontSize: '0.75rem', color: '#999' }}>-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="uam-stats">
        <span>合計: {users.length}人</span>
        <span>許可: {users.filter(u => u.status === 'allowed').length}人</span>
        <span>ブロック: {users.filter(u => u.status === 'blocked').length}人</span>
        <span>管理者: {users.filter(u => u.isAdmin).length}人</span>
        {isSuperAdmin && <span>進路: {users.filter(u => u.isGuidanceMember).length}人</span>}
      </div>
    </div>
  );
};

export default UserAccessManager;
