import React, { useEffect, useMemo, useState } from 'react';
import { recurringTemplatesService, WeeklyTemplate } from '../../firebase/recurringTemplates';
import { removeTemplateLocksByTemplate } from '../../firebase/templateLocks';
import { PERIOD_ORDER, periodTimeMap } from '../../utils/periods';
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

  const formatPeriods = (periods: (number|string)[]) =>
    periods.map(p => {
      const k = String(p) as keyof typeof periodTimeMap;
      if (periodTimeMap[k]) return periodTimeMap[k].name;
      return /^\d+$/.test(String(p)) ? `${p}限` : String(p);
    }).join(', ');

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
      // 余分な項目はもたせない
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

  // 新規追加: テンプレートの固定予約を削除
  const removeTemplateLocks = async (templateId: string) => {
    if (!isAdmin) { setError('管理者のみ削除できます'); return; }
    if (!window.confirm('このテンプレートで作成された固定予約を削除しますか？\n\n※テンプレート自体は削除されません')) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await removeTemplateLocksByTemplate(templateId);
      setError(null);
      alert(`${result.deleted}件の固定予約を削除しました`);
    } catch (e: any) {
      setError(e?.message || '固定予約の削除に失敗しました');
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
              <th>時限</th>
              <th>期間</th>
              <th>優先度</th>
              <th>カテゴリ</th>
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
                <td>{formatPeriods(it.periods)}</td>
                <td>{it.startDate}{it.endDate ? ` 〜 ${it.endDate}` : ''}</td>
                <td>-</td>
                <td>-</td>
                <td>{it.enabled ? '有効' : '無効'}</td>
                <td className="rtm-actions">
                  {isAdmin && (
                    <>
                      <button onClick={() => setEditing(it)}>編集</button>
                      <button onClick={() => remove(it.id)}>削除</button>
                      <button 
                        onClick={() => removeTemplateLocks(it.id!)} 
                        className="remove-locks-button"
                        title="このテンプレートで作成された固定予約を削除"
                      >
                        固定予約削除
                      </button>
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
            <label>時限</label>
            <div className="period-toggle-grid">
              {PERIOD_ORDER.map(key => (
                <label key={key} className={`toggle ${editing.periods.map(String).includes(String(key)) ? 'on' : 'off'}`}>
                  <input
                    type="checkbox"
                    checked={editing.periods.map(String).includes(String(key))}
                    onChange={(e) => {
                      const strPeriods = editing.periods.map(String);
                      let next: (number|string)[];
                      if (e.target.checked) {
                        next = [...strPeriods, String(key)];
                      } else {
                        next = strPeriods.filter(p => p !== String(key));
                      }
                      // 数値に戻せるものは数値で保持
                      const normalized = next.map(p => (/^\d+$/.test(String(p)) ? Number(p) : String(p)) as (number|string));
                      setEditing({ ...editing, periods: normalized });
                    }}
                  />
                  <span>{periodTimeMap[key].name}</span>
                </label>
              ))}
            </div>
          </div>
          {/* 不要オプションは撤去（固定予約はシンプル運用） */}

          <div className="form-row">
            <label>開始日（適用範囲）</label>
            <input 
              type="date" 
              value={editing.startDate} 
              onChange={e => setEditing({ ...editing, startDate: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>終了日（適用範囲）</label>
            <input 
              type="date" 
              value={editing.endDate || ''} 
              onChange={e => setEditing({ ...editing, endDate: e.target.value || undefined })}
            />
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
