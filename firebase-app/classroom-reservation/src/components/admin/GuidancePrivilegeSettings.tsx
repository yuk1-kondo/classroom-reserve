/**
 * 進路指導部：会議室のみ先日付制限を免除する特例の設定（スーパー管理者向け）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { guidancePrivilegeService, GuidanceMemberRecord } from '../../firebase/guidancePrivilege';
import { userAccessService, UserAccessRecord } from '../../firebase/userAccess';
import { useAuth } from '../../hooks/useAuth';
import { Room, roomsService } from '../../firebase/firestore';

interface Props {
  currentUserId?: string;
  hideTitle?: boolean;
}

export const GuidancePrivilegeSettings: React.FC<Props> = ({ currentUserId, hideTitle }) => {
  const { isSuperAdmin } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [meetingRoomId, setMeetingRoomId] = useState('');
  const [members, setMembers] = useState<GuidanceMemberRecord[]>([]);
  const [newUid, setNewUid] = useState('');
  const [accessUsers, setAccessUsers] = useState<UserAccessRecord[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const memberUidSet = useMemo(() => new Set(members.map(m => m.uid)), [members]);

  const pickerRows = useMemo(() => {
    let list = accessUsers.filter(u => u.status === 'allowed');
    const q = pickerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        u =>
          (u.email?.toLowerCase().includes(q)) ||
          (u.displayName?.toLowerCase().includes(q)) ||
          u.uid.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 80);
  }, [accessUsers, pickerSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const [list, rlist, mid, accessList] = await Promise.all([
        guidancePrivilegeService.listMembers(),
        roomsService.getAllRooms(),
        guidancePrivilegeService.getMeetingRoomId(),
        userAccessService.getAllUsers()
      ]);
      setMembers(list.sort((a, b) => (a.uid || '').localeCompare(b.uid || '')));
      setRooms(Array.isArray(rlist) ? rlist : []);
      setMeetingRoomId(mid || '');
      setAccessUsers(accessList);
    } catch (e) {
      console.error(e);
      setMessage('読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const handleSaveRoom = async () => {
    if (!currentUserId || !meetingRoomId.trim()) {
      setMessage('会議室を選択してください');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await guidancePrivilegeService.upsertPrivilegeSettings(meetingRoomId.trim(), currentUserId);
      setMessage('会議室の紐付けを保存しました');
    } catch (e: any) {
      setMessage(e?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    const uid = newUid.trim();
    if (!currentUserId || !uid) return;
    setSaving(true);
    setMessage(null);
    try {
      await guidancePrivilegeService.addMember(uid, currentUserId);
      setNewUid('');
      await load();
      setMessage(`メンバーを追加しました（${uid}）`);
    } catch (e: any) {
      setMessage(e?.message || '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFromAccessList = async (uid: string) => {
    if (!currentUserId || memberUidSet.has(uid)) return;
    setSaving(true);
    setMessage(null);
    try {
      await guidancePrivilegeService.addMember(uid, currentUserId);
      await load();
      setMessage(`メンバーを追加しました（${uid}）`);
    } catch (e: any) {
      setMessage(e?.message || '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (uid: string) => {
    if (!window.confirm(`このメンバーを削除しますか？\n${uid}`)) return;
    setSaving(true);
    try {
      await guidancePrivilegeService.removeMember(uid);
      await load();
      setMessage('メンバーを削除しました');
    } catch (e: any) {
      setMessage(e?.message || '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="admin-settings-block">
        <p>この設定はスーパー管理者のみが利用できます。</p>
      </div>
    );
  }

  return (
    <div className="admin-settings-block">
      {!hideTitle && <h3>進路指導部・会議室（先日付特例）</h3>}
      <p className="admin-settings-desc">
        登録メンバーは、下で指定した<strong>会議室</strong>についてのみ、全体の予約最終日を超えた日付でも予約できます。禁止期間の設定は従います。
      </p>

      {message && <p className="admin-settings-message">{message}</p>}

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label htmlFor="gp-meeting-room">特例の対象教室（会議室）</label>
            <select
              id="gp-meeting-room"
              value={meetingRoomId}
              onChange={e => setMeetingRoomId(e.target.value)}
              disabled={saving}
            >
              <option value="">選択してください</option>
              {rooms
                .filter(r => r.id)
                .map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <button type="button" className="admin-settings-save" onClick={handleSaveRoom} disabled={saving || !meetingRoomId}>
              紐付けを保存
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label htmlFor="gp-picker-search">メンバー追加（ログイン済みユーザー一覧）</label>
            <input
              id="gp-picker-search"
              type="search"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="氏名・メール・UID で検索"
              style={{ width: '100%', maxWidth: '420px', marginBottom: '8px' }}
              disabled={saving}
            />
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
              「許可」状態かつログイン履歴のあるユーザーを最大80件表示します。年度初めのログイン後に一覧へ反映されます。
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
                  該当するユーザーがありません（検索条件を変えるか、ユーザー管理で同期してください）。
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {pickerRows.map(u => {
                    const already = memberUidSet.has(u.uid);
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
                          <code style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{u.uid}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddFromAccessList(u.uid)}
                          disabled={saving || already}
                        >
                          {already ? '登録済' : '進路に追加'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label htmlFor="gp-new-uid">メンバー追加（Firebase UID・手入力）</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                id="gp-new-uid"
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
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '6px' }}>
              まだ一度もログインしておらず一覧に出ない場合などに利用できます。
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '1rem' }}>登録済みメンバー（{members.length}名）</h4>
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
                    <code>{m.uid}</code>
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
    </div>
  );
};

export default GuidancePrivilegeSettings;
