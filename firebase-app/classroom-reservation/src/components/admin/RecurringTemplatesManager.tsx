import React, { useEffect, useMemo, useState } from 'react';
import { recurringTemplatesService, WeeklyTemplate } from '../../firebase/recurringTemplates';
import './RecurringTemplatesManager.css';

type Props = {
  isAdmin: boolean;
  currentUserId?: string;
  roomOptions: { id: string; name: string }[];
};

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

export default function RecurringTemplatesManager({ isAdmin, currentUserId, roomOptions }: Props) {
  const [items, setItems] = useState<WeeklyTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<WeeklyTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomMap = useMemo(() => Object.fromEntries(roomOptions.map(r => [r.id, r.name])), [roomOptions]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await recurringTemplatesService.list();
      setItems(list);
    } catch (e: any) {
      setError(e?.message || '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing({
      name: '',
      roomId: roomOptions[0]?.id || '',
      weekday: 1,
      periods: [],
      startDate: new Date().toISOString().slice(0,10),
      endDate: undefined,
      createdBy: currentUserId || 'unknown',
      enabled: true,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!isAdmin) { setError('管理者のみ編集できます'); return; }
    if (!editing.name || !editing.roomId || editing.weekday == null || editing.periods.length === 0) {
      setError('名称/教室/曜日/コマを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await recurringTemplatesService.upsert({ ...editing, updatedBy: currentUserId });
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    if (!isAdmin) { setError('管理者のみ削除できます'); return; }
  if (!window.confirm('このテンプレートを削除しますか？')) return;
    setLoading(true);
    setError(null);
    try {
      await recurringTemplatesService.remove(id);
      await load();
    } catch (e: any) {
      setError(e?.message || '削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rtm-wrap">
      <div className="rtm-header">
        <h3>固定（毎週）予約テンプレート</h3>
        <div>
          <button onClick={load} disabled={loading}>再読込</button>
          {isAdmin && <button onClick={startNew} disabled={loading}>新規作成</button>}
        </div>
      </div>
      {error && <div className="rtm-error">{error}</div>}
      {loading && <div className="rtm-loading">読み込み中…</div>}

      {!editing && (
        <table className="rtm-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>教室</th>
              <th>曜日</th>
              <th>コマ</th>
              <th>期間</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.name}</td>
                <td>{roomMap[it.roomId] || it.roomId}</td>
                <td>{weekdays[it.weekday]}</td>
                <td>{it.periods.join(', ')}</td>
                <td>{it.startDate}{it.endDate ? ` 〜 ${it.endDate}` : ''}</td>
                <td>{it.enabled ? '有効' : '無効'}</td>
                <td className="rtm-actions">
                  {isAdmin && (
                    <>
                      <button onClick={() => setEditing(it)}>編集</button>
                      <button onClick={() => remove(it.id)}>削除</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="rtm-editor">
          <div className="form-row">
            <label>名称</label>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>教室</label>
            <select value={editing.roomId} onChange={e => setEditing({ ...editing, roomId: e.target.value })}>
              {roomOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>曜日</label>
            <select value={editing.weekday} onChange={e => setEditing({ ...editing, weekday: Number(e.target.value) })}>
              {weekdays.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>コマ</label>
            <input placeholder="例: 1,2" value={editing.periods.join(',')} onChange={e => {
              const arr = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
              setEditing({ ...editing, periods: arr });
            }} />
          </div>
          <div className="form-row">
            <label>開始日</label>
            <input type="date" value={editing.startDate} onChange={e => setEditing({ ...editing, startDate: e.target.value })} />
          </div>
          <div className="form-row">
            <label>終了日</label>
            <input type="date" value={editing.endDate || ''} onChange={e => setEditing({ ...editing, endDate: e.target.value || undefined })} />
          </div>
          <div className="form-row">
            <label>状態</label>
            <select value={editing.enabled ? '1' : '0'} onChange={e => setEditing({ ...editing, enabled: e.target.value === '1' })}>
              <option value="1">有効</option>
              <option value="0">無効</option>
            </select>
          </div>
          <div className="rtm-editor-actions">
            <button onClick={() => setEditing(null)}>キャンセル</button>
            {isAdmin && <button onClick={save} disabled={loading}>保存</button>}
          </div>
        </div>
      )}
    </div>
  );
}
