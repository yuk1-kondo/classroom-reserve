/**
 * 駐車場：枠の登録・公開切替・メンバー／削除権限
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PARKING_SPOTS, ParkingAccessMode } from '../../constants/parking';
import {
  parkingPrivilegeService,
  parkingSettingsService,
  parkingSpotsService,
  ParkingMemberRecord,
  isParkingMembershipActive
} from '../../firebase/parking';
import { userAccessService, UserAccessRecord } from '../../firebase/userAccess';
import { useAuth } from '../../hooks/useAuth';
import './admin-settings-blocks.css';

interface Props {
  currentUserId?: string;
  hideTitle?: boolean;
}

export const ParkingGroupSettings: React.FC<Props> = ({ currentUserId, hideTitle }) => {
  const { isAdmin } = useAuth();
  const [spotLoading, setSpotLoading] = useState(false);
  const [spotMessage, setSpotMessage] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<ParkingAccessMode>('group');
  const [modeSaving, setModeSaving] = useState(false);
  const [modeMessage, setModeMessage] = useState<string | null>(null);

  const [members, setMembers] = useState<ParkingMemberRecord[]>([]);
  const [newUid, setNewUid] = useState('');
  const [accessUsers, setAccessUsers] = useState<UserAccessRecord[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [memberLoading, setMemberLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);

  const activeUids = useMemo(
    () => new Set(members.filter(isParkingMembershipActive).map(m => m.uid)),
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
      const [list, accessList, mode] = await Promise.all([
        parkingPrivilegeService.listMembers(),
        userAccessService.getAllUsers(),
        parkingSettingsService.getAccessMode()
      ]);
      setMembers(list.sort((a, b) => (a.uid || '').localeCompare(b.uid || '')));
      setAccessUsers(accessList);
      setAccessMode(mode);
    } catch (e) {
      console.error(e);
      setMemberMessage('メンバー一覧の読み込みに失敗しました');
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadMembers();
  }, [isAdmin]);

  const handleEnsureSpots = async () => {
    setSpotLoading(true);
    setSpotMessage(null);
    try {
      const { added, skipped } = await parkingSpotsService.ensureSpots();
      const parts: string[] = [];
      if (added.length) parts.push(`新規追加: ${added.join('、')}`);
      if (skipped.length) parts.push(`既に登録済: ${skipped.join('、')}`);
      setSpotMessage(parts.length ? parts.join(' / ') : '処理しました。');
    } catch (e: any) {
      setSpotMessage(e?.message || '駐車場枠の登録に失敗しました');
    } finally {
      setSpotLoading(false);
    }
  };

  const handleSetMode = async (mode: ParkingAccessMode) => {
    if (!currentUserId) return;
    setModeSaving(true);
    setModeMessage(null);
    try {
      await parkingSettingsService.setAccessMode(mode, currentUserId);
      setAccessMode(mode);
      setModeMessage(mode === 'public' ? '全員公開に切り替えました' : 'テスト（グループのみ）に切り替えました');
    } catch (e: any) {
      setModeMessage(e?.message || '公開設定の保存に失敗しました');
    } finally {
      setModeSaving(false);
    }
  };

  const handleAddMember = async (uid: string, canDelete = false) => {
    if (!currentUserId || !uid) return;
    setSaving(true);
    setMemberMessage(null);
    try {
      await parkingPrivilegeService.addMember(uid, currentUserId, canDelete);
      setNewUid('');
      await loadMembers();
      setMemberMessage(`メンバーを追加しました（${uid}）`);
    } catch (e: any) {
      setMemberMessage(e?.message || '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDelete = async (uid: string, canDelete: boolean) => {
    setSaving(true);
    setMemberMessage(null);
    try {
      await parkingPrivilegeService.setCanDelete(uid, canDelete);
      await loadMembers();
      setMemberMessage(canDelete ? '削除権限を付与しました' : '削除権限を外しました');
    } catch (e: any) {
      setMemberMessage(e?.message || '削除権限の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (uid: string) => {
    if (!window.confirm(`このメンバーを削除しますか？\n${uid}`)) return;
    setSaving(true);
    try {
      await parkingPrivilegeService.removeMember(uid);
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
      {!hideTitle && <h3>駐車場グループ</h3>}

      <section style={{ marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>駐車場4枠の登録</h4>
        <p className="admin-settings-desc">
          教室予約の <code>rooms</code> には追加しません。駐車場専用コレクションへ次の4枠を登録します。
        </p>
        <ul style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          {PARKING_SPOTS.map(r => (
            <li key={r.id}>{r.name}</li>
          ))}
        </ul>
        <button type="button" className="admin-settings-save" onClick={handleEnsureSpots} disabled={spotLoading}>
          {spotLoading ? '処理中…' : '駐車場4枠を登録'}
        </button>
        {spotMessage && <p className="admin-settings-message">{spotMessage}</p>}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>公開範囲</h4>
        <p className="admin-settings-desc">
          テスト中はグループメンバー（と管理者）のみ。完了後に全員公開へ切り替えます（再デプロイ不要）。
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <button
            type="button"
            className="admin-settings-save"
            onClick={() => handleSetMode('group')}
            disabled={modeSaving || accessMode === 'group'}
          >
            テスト（グループのみ）
          </button>
          <button
            type="button"
            className="admin-settings-save"
            onClick={() => handleSetMode('public')}
            disabled={modeSaving || accessMode === 'public'}
          >
            全員公開
          </button>
        </div>
        <p style={{ fontSize: '0.9rem' }}>
          現在: <strong>{accessMode === 'public' ? '全員公開' : 'テスト（グループのみ）'}</strong>
        </p>
        {modeMessage && <p className="admin-settings-message">{modeMessage}</p>}
      </section>

      {isAdmin && (
        <section>
          <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>駐車場グループメンバー</h4>
          <p className="admin-settings-desc">
            テスト中の利用権限です。チェックした人は公開後も他人の駐車場予約を削除できます。
          </p>
          {memberMessage && <p className="admin-settings-message">{memberMessage}</p>}
          {memberLoading ? (
            <p>読み込み中…</p>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="pg-picker-search">メンバー追加（ログイン済みユーザー一覧）</label>
                <input
                  id="pg-picker-search"
                  type="search"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="氏名・メール・UID で検索"
                  style={{ width: '100%', maxWidth: '420px', marginBottom: '8px' }}
                  disabled={saving}
                />
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
                    <p style={{ margin: '8px 0', fontSize: '0.9rem', color: '#666' }}>該当するユーザーがありません。</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {pickerRows.map(u => {
                        const already = activeUids.has(u.uid);
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
                            <button type="button" onClick={() => handleAddMember(u.uid)} disabled={saving || already}>
                              {already ? '登録済' : '駐車場に追加'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="pg-new-uid">メンバー追加（Firebase UID・手入力）</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    id="pg-new-uid"
                    type="text"
                    value={newUid}
                    onChange={e => setNewUid(e.target.value)}
                    placeholder="ユーザーの UID"
                    style={{ minWidth: '280px' }}
                    disabled={saving}
                  />
                  <button type="button" onClick={() => handleAddMember(newUid.trim())} disabled={saving || !newUid.trim()}>
                    追加
                  </button>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem' }}>
                  登録済みメンバー（{members.filter(isParkingMembershipActive).length}名）
                </h4>
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
                          gap: '8px',
                          padding: '8px 0',
                          borderBottom: '1px solid #eee',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span>
                          <code>{m.uid}</code>
                          {m.canDelete && (
                            <span style={{ fontSize: '0.75rem', color: '#b45309', marginLeft: '8px' }}>削除権限あり</span>
                          )}
                          {!isParkingMembershipActive(m) && (
                            <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: '8px' }}>（無効）</span>
                          )}
                        </span>
                        <span style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleDelete(m.uid, !m.canDelete)}
                            disabled={saving}
                          >
                            {m.canDelete ? '削除権限を外す' : '削除権限を付ける'}
                          </button>
                          <button type="button" onClick={() => handleRemove(m.uid)} disabled={saving}>
                            削除
                          </button>
                        </span>
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

export default ParkingGroupSettings;
