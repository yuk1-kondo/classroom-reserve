/**
 * 進路指導部：会議室のみ先日付制限を免除する特例の設定（スーパー管理者向け）
 */
import React, { useEffect, useState } from 'react';
import { guidancePrivilegeService, GuidanceMemberRecord } from '../../firebase/guidancePrivilege';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, rlist, mid] = await Promise.all([
        guidancePrivilegeService.listMembers(),
        roomsService.getAllRooms(),
        guidancePrivilegeService.getMeetingRoomId()
      ]);
      setMembers(list.sort((a, b) => (a.uid || '').localeCompare(b.uid || '')));
      setRooms(Array.isArray(rlist) ? rlist : []);
      setMeetingRoomId(mid || '');
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
            <label htmlFor="gp-new-uid">メンバー追加（Firebase UID）</label>
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
              UID は管理画面のユーザー一覧や Firebase Authentication から確認できます。
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
