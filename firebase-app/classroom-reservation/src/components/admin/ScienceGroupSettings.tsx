/**
 * 理科グループ：実験3室の登録・メンバー管理
 */
import React, { useEffect, useMemo, useState } from 'react';
import { migrationService, SCIENCE_LAB_ROOMS } from '../../firebase/migration';
import {
  sciencePrivilegeService,
  ScienceMemberRecord,
  isScienceMembershipActive
} from '../../firebase/sciencePrivilege';
import { userAccessService, UserAccessRecord } from '../../firebase/userAccess';
import { useAuth } from '../../hooks/useAuth';
import './admin-settings-blocks.css';

interface Props {
  currentUserId?: string;
  hideTitle?: boolean;
}

export const ScienceGroupSettings: React.FC<Props> = ({ currentUserId, hideTitle }) => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomMessage, setRoomMessage] = useState<string | null>(null);

  const [members, setMembers] = useState<ScienceMemberRecord[]>([]);
  const [newUid, setNewUid] = useState('');
  const [accessUsers, setAccessUsers] = useState<UserAccessRecord[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [memberLoading, setMemberLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);

  const activeScienceUids = useMemo(
    () => new Set(members.filter(isScienceMembershipActive).map(m => m.uid)),
    [members]
  );

  const pickerRows = useMemo(() => {
    let list = accessUsers.filter(u => u.status === 'allowed');
    const q = pickerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        u =>
          u.email?.toLowerCase().includes(q) ||
          u.displayName?.toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 80);
  }, [accessUsers, pickerSearch]);

  const loadMembers = async () => {
    setMemberLoading(true);
    try {
      const [list, accessList] = await Promise.all([
        sciencePrivilegeService.listMembers(),
        userAccessService.getAllUsers()
      ]);
      setMembers(list.sort((a, b) => (a.uid || '').localeCompare(b.uid || '')));
      setAccessUsers(accessList);
    } catch (e) {
      console.error(e);
      setMemberMessage('メンバー一覧の読み込みに失敗しました');
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) loadMembers();
  }, [isSuperAdmin]);

  const handleEnsureRooms = async () => {
    setRoomLoading(true);
    setRoomMessage(null);
    try {
      const { added, updated, skipped } = await migrationService.ensureScienceLabRooms();
      const parts: string[] = [];
      if (added.length) parts.push(`新規追加: ${added.join('、')}`);
      if (updated.length) parts.push(`既存に理科専用フラグ付与: ${updated.join('、')}`);
      if (skipped.length) parts.push(`既に登録済（変更なし）: ${skipped.join('、')}`);
      setRoomMessage(parts.length ? parts.join(' / ') : '処理しました。');
    } catch (e: any) {
      setRoomMessage(e?.message || '教室の追加に失敗しました');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleAddMember = async () => {
    const uid = newUid.trim();
    if (!currentUserId || !uid) return;
    setSaving(true);
    setMemberMessage(null);
    try {
      await sciencePrivilegeService.addMember(uid, currentUserId);
      setNewUid('');
      await loadMembers();
      setMemberMessage(`メンバーを追加しました（${uid}）`);
    } catch (e: any) {
      setMemberMessage(e?.message || '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFromAccessList = async (uid: string) => {
    if (!currentUserId || activeScienceUids.has(uid)) return;
    setSaving(true);
    setMemberMessage(null);
    try {
      await sciencePrivilegeService.addMember(uid, currentUserId);
      await loadMembers();
      setMemberMessage(`メンバーを追加しました（${uid}）`);
    } catch (e: any) {
      setMemberMessage(e?.message || '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (uid: string) => {
    if (!window.confirm(`このメンバーを削除しますか？\n${uid}`)) return;
    setSaving(true);
    try {
      await sciencePrivilegeService.removeMember(uid);
      await loadMembers();
      setMemberMessage('メンバーを削除しました');
    } catch (e: any) {
      setMemberMessage(e?.message || '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-settings-block">
        <p>この設定は管理者のみが利用できます。</p>
      </div>
    );
  }

  return (
    <div className="admin-settings-block">
      {!hideTitle && <h3>理科グループ・実験室</h3>}

      <section style={{ marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>実験3室の登録</h4>
        <p className="admin-settings-desc">
          次の教室を <strong>理科グループ専用（<code>scienceGroupOnly</code>）</strong> として登録します。
          同名の教室が既にある場合は、理科専用フラグと説明を更新します。
        </p>
        <ul style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          {SCIENCE_LAB_ROOMS.map(r => (
            <li key={r.name}>{r.name}</li>
          ))}
        </ul>
        <button
          type="button"
          className="admin-settings-save"
          onClick={handleEnsureRooms}
          disabled={roomLoading}
        >
          {roomLoading ? '処理中…' : '理科3室を登録・更新'}
        </button>
        {roomMessage && <p className="admin-settings-message">{roomMessage}</p>}
      </section>

      {!isSuperAdmin && (
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          メンバー登録・一覧は <strong>スーパー管理者</strong> が「ユーザー管理」と同様に操作できます（理科バッジ・理科追加/解除）。
        </p>
      )}

      {isSuperAdmin && (
        <section>
          <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>理科グループメンバー</h4>
          <p className="admin-settings-desc">
            登録メンバーは <strong>生物・化学・物理実験室</strong> を予約・閲覧できます（Firestore ルールと連動）。
          </p>

          {memberMessage && <p className="admin-settings-message">{memberMessage}</p>}

          {memberLoading ? (
            <p>読み込み中…</p>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="sg-picker-search">メンバー追加（ログイン済みユーザー一覧）</label>
                <input
                  id="sg-picker-search"
                  type="search"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="氏名・メール・UID で検索"
                  style={{ width: '100%', maxWidth: '420px', marginBottom: '8px' }}
                  disabled={saving}
                />
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
                  「許可」状態のユーザーを最大80件表示します。
                </p>
                <div
                  style={{
                    maxHeight: '240px',
                    overflow: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '4px 8px'
                  }}
                >
                  {pickerRows.length === 0 ? (
                    <p style={{ margin: '8px 0', fontSize: '0.9rem', color: '#666' }}>
                      該当するユーザーがありません。
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {pickerRows.map(u => {
                        const already = activeScienceUids.has(u.uid);
                        return (
                          <li
                            key={u.uid}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 4px',
                              borderBottom: '1px solid #eee',
                              fontSize: '0.9rem'
                            }}
                          >
                            <span>
                              <strong>{u.displayName || '（名前なし）'}</strong>
                              <span style={{ color: '#555', marginLeft: '8px' }}>{u.email}</span>
                              <code style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>
                                {u.uid}
                              </code>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddFromAccessList(u.uid)}
                              disabled={saving || already}
                            >
                              {already ? '登録済' : '理科に追加'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="sg-new-uid">メンバー追加（Firebase UID・手入力）</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    id="sg-new-uid"
                    type="text"
                    value={newUid}
                    onChange={e => setNewUid(e.target.value)}
                    placeholder="ユーザーの UID"
                    style={{ minWidth: '280px' }}
                    disabled={saving}
                  />
                  <button type="button" onClick={handleAddMember} disabled={saving || !newUid.trim()}>
                    追加
                  </button>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem' }}>登録済みメンバー（{members.filter(isScienceMembershipActive).length}名）</h4>
                {members.length === 0 ? (
                  <p>まだ登録がありません</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {members.map(m => (
                      <li
                        key={m.uid}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid #eee'
                        }}
                      >
                        <span>
                          <code>{m.uid}</code>
                          {!isScienceMembershipActive(m) && (
                            <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: '8px' }}>
                              （無効）
                            </span>
                          )}
                        </span>
                        <button type="button" onClick={() => handleRemove(m.uid)} disabled={saving}>
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default ScienceGroupSettings;
