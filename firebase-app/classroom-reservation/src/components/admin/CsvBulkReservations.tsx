import React, { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { roomsService, reservationsService, PERIOD_ORDER, createDateTimeFromPeriod } from '../../firebase/firestore';
import { displayLabel } from '../../utils/periodLabel';
import { useSystemSettings } from '../../hooks/useSystemSettings';

type RoomOption = { id: string; name: string };

type Props = {
  currentUserId?: string;
  roomOptions?: RoomOption[]; // 省略時は内部で取得
};

type CsvRow = {
  weekday: number; // 0(日) - 6(土)
  roomKey: string; // id または name
  periods: string[]; // '1','2','lunch','after' など
  title?: string; // 予約の内容（オプション）
};

type PreviewItem = CsvRow & { roomId?: string; roomName?: string; error?: string };

const weekdaysJp = ['日','月','火','水','木','金','土'];

function parseWeekday(cell: string): number | null {
  const vRaw = (cell || '').replace(/^\ufeff/, '').trim(); // BOM除去
  const v = vRaw.replace(/^"|"$/g, ''); // 囲みダブルクオート除去
  if (v === '') return null;
  // 数値 0-6
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return n >= 0 && n <= 6 ? n : null;
  }
  // 日本語一文字
  const idx = weekdaysJp.indexOf(v.length > 1 && v.endsWith('曜日') ? v[0] : v);
  if (idx >= 0) return idx;
  // 英語表記
  const map: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  const key = v.toLowerCase().slice(0,3);
  if (key in map) return map[key];
  return null;
}

function expandPeriods(cell: string): string[] {
  const raw = cell.split(',').map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const token of raw) {
    if (token.includes('-')) {
      const [a, b] = token.split('-').map(s => s.trim());
      const startIdx = PERIOD_ORDER.indexOf(a as any);
      const endIdx = PERIOD_ORDER.indexOf(b as any);
      if (startIdx >= 0 && endIdx >= 0 && startIdx <= endIdx) {
        out.push(...PERIOD_ORDER.slice(startIdx, endIdx + 1));
      }
    } else {
      out.push(token);
    }
  }
  // 正規化（重複除去）
  return Array.from(new Set(out));
}

// 連続する時限をグループ化（例: ["1","2","3","5"] → [["1","2","3"],["5"]])
function groupContiguousPeriods(periods: string[]): string[][] {
  const order = PERIOD_ORDER as readonly string[];
  const indices = periods
    .map(p => order.indexOf(p as any))
    .filter(i => i >= 0)
    .sort((a, b) => a - b);
  const result: string[][] = [];
  let current: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const p = order[idx];
    if (current.length === 0) {
      current.push(p);
    } else {
      const prevIdx = order.indexOf(current[current.length - 1] as any);
      if (idx === prevIdx + 1) {
        current.push(p);
      } else {
        result.push(current);
        current = [p];
      }
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

function iterateDates(startStr: string, endStr: string): Date[] {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const out: Date[] = [];
  while (d <= end) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}

export default function CsvBulkReservations({ currentUserId, roomOptions }: Props) {
  const [busy, setBusy] = useState(false);
  const [csvText, setCsvText] = useState<string>('');
  const [rows, setRows] = useState<PreviewItem[]>([]);
  const { maxDateStr, limitMonths } = useSystemSettings();
  const [rangeStart, setRangeStart] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    if (maxDateStr) return maxDateStr;
    const d = new Date(); d.setMonth(d.getMonth() + (limitMonths || 3)); return d.toISOString().slice(0,10);
  });
  const [message, setMessage] = useState<string>('');
  const [skipExisting, setSkipExisting] = useState<boolean>(true);
  const [rooms, setRooms] = useState<RoomOption[]>(roomOptions || []);

  // ルーム名の正規化（①→1、②→2、全角数字→半角、前後空白除去）
  const normalizeRoomName = (name: string): string => {
    const circledToAscii: Record<string, string> = {
      '①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10'
    };
    const fullToHalfDigits = (s: string) => s.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
    const replaced = (name || '')
      .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, m => circledToAscii[m] || m)
      .replace(/グローバル教室[\s]*No\.?/i, 'グローバル教室')
      .replace(/\s+/g, '')
      .trim();
    return fullToHalfDigits(replaced);
  };

  const roomMapById = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r.name])), [rooms]);
  // 名前の別表記も同じIDへ解決できるよう、正規化名でも引けるマップを作成
  const roomIdByName = useMemo(() => {
    const entries: [string, string][] = [];
    for (const r of rooms) {
      const original = (r.name || '').trim();
      const canonical = normalizeRoomName(original);
      entries.push([original, r.id]);
      if (canonical !== original) entries.push([canonical, r.id]);
      // グローバル教室① → グローバル教室1 の補助キー（冗長だが安全）
      const numeric = original.replace('①','1').replace('②','2');
      if (numeric !== original && numeric !== canonical) entries.push([numeric, r.id]);
    }
    return Object.fromEntries(entries);
  }, [rooms]);

  const loadRoomsIfNeeded = async () => {
    if (rooms.length > 0) return;
    const list = await roomsService.getAllRooms();
    setRooms(list.map((r: any) => ({ id: String(r.id), name: String(r.name) })));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadRoomsIfNeeded();
    const text = await file.text();
    setCsvText(text);
    parse(text);
  };

  const normalizeCell = (s: string) => (s || '').replace(/^\ufeff/, '').trim().replace(/^"|"$/g, '');

  const parse = (text: string) => {
    const cleaned = (text || '').replace(/^\ufeff/, '');
    const lines = cleaned.split(/\r?\n/).filter(l => l.trim() !== '' && !/^#/.test(l.trim()));
    const result: PreviewItem[] = [];
    if (lines.length === 0) { setRows(result); return; }

    // ヘッダー対応: weekday/曜日, room/room_name/教室, periods/period/時限, title/entry/内容
    const headerRaw = lines[0].split(',').map(normalizeCell);
    const header = headerRaw.map(s => s.toLowerCase());
    const hasHeader = header.length >= 3 && (
      header.includes('weekday') || header.includes('day') || header.includes('曜日')
    );

    // ヘッダー列名のインデックス解決
    const findIdx = (cands: string[]): number => {
      for (const name of cands) {
        const idx = header.indexOf(name.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const wdIdxHeader = hasHeader ? findIdx(['weekday','day','曜日']) : -1;
    const roomIdxHeader = hasHeader ? findIdx(['room','room_name','教室','room id','roomid']) : -1;
    const periodsIdxHeader = hasHeader ? findIdx(['periods','period','時限']) : -1;
    const titleIdxHeader = hasHeader ? findIdx(['title','entry','内容']) : -1;

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const idx = i;
      const line = lines[i];
      const cols = line.split(',').map(normalizeCell);
      if (cols.length < 3) { result.push({ weekday: -1 as any, roomKey: '', periods: [], error: `行${idx+1}: 列不足` }); continue; }
      const wdCol = hasHeader && wdIdxHeader >= 0 ? cols[wdIdxHeader] : cols[0];
      const roomCol = hasHeader && roomIdxHeader >= 0 ? cols[roomIdxHeader] : cols[1];
      const periodsCol = hasHeader && periodsIdxHeader >= 0 ? cols[periodsIdxHeader] : cols[2];
      const titleCol = hasHeader && titleIdxHeader >= 0 ? cols[titleIdxHeader] : (cols.length >= 4 ? cols.slice(3).join(',') : '');
      const wd = parseWeekday(wdCol);
      const roomKey = normalizeRoomName((roomCol || ''));
      const periodsCell = (periodsCol || '').trim();
      const titleCell = (titleCol || '').trim();
      const periods = expandPeriods(periodsCell);
      if (wd == null) { result.push({ weekday: -1 as any, roomKey, periods, error: `行${idx+1}: 曜日が不正` }); continue; }
      const roomId = roomMapById[roomKey] ? roomKey : (roomIdByName[roomKey] || undefined);
      const roomName = roomId ? roomMapById[roomId] : undefined;
      result.push({ weekday: wd, roomKey, periods, roomId, roomName, title: titleCell || undefined, error: roomId ? undefined : `行${idx+1}: 教室が見つかりません (${roomKey})` });
    }
    setRows(result);
  };

  const handleApply = async () => {
    if (!currentUserId) { alert('管理者でログインしてください'); return; }
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) { alert('期間を正しく指定してください'); return; }
    // システム上限の強制適用（UIのmaxとダブルチェック）
    const effectiveEnd = maxDateStr && rangeEnd > maxDateStr ? maxDateStr : rangeEnd;
    if (rows.length === 0) { alert('CSVを読み込んでください'); return; }
    const hasError = rows.some(r => r.error);
    if (hasError) { alert('CSVにエラーがあります。修正してください'); return; }

    try {
      setBusy(true); setMessage('予約作成中...');
      const dates = iterateDates(rangeStart, effectiveEnd);
      let created = 0; let skipped = 0; let errors = 0;

      for (const d of dates) {
        const ymd = d.toISOString().slice(0,10);
        const dayReservations = await reservationsService.getDayReservations(new Date(ymd));

        for (const row of rows) {
          if (d.getDay() !== row.weekday) continue;
          const roomId = row.roomId!;
          // 連続時限はまとめて1予約にする
          const groups = groupContiguousPeriods(row.periods);
          for (const group of groups) {
            // 既存重複チェック（グループ内のいずれかが衝突したらスキップ）
            const hasConflict = group.some(period =>
              dayReservations.some(r => r.roomId === roomId && (
                r.period === period || (r.period.includes(',') && r.period.split(',').map(p => p.trim()).includes(period))
              ))
            );
            if (hasConflict && skipExisting) { skipped++; continue; }

            const first = group[0];
            const last = group[group.length - 1];
            const dtStart = createDateTimeFromPeriod(ymd, first);
            const dtEnd = createDateTimeFromPeriod(ymd, last);
            if (!dtStart || !dtEnd) { errors++; continue; }
            const periodStr = group.join(',');
            const periodName = group.length > 1 ? `${displayLabel(first)}〜${displayLabel(last)}` : displayLabel(first);
            try {
              await reservationsService.addReservation({
                roomId,
                roomName: row.roomName || roomMapById[roomId] || roomId,
                title: row.title || '固定予約',
                reservationName: '管理者',
                startTime: Timestamp.fromDate(dtStart.start),
                endTime: Timestamp.fromDate(dtEnd.end),
                period: periodStr,
                periodName,
                createdAt: Timestamp.now(),
                createdBy: currentUserId
              });
              created++;
            } catch (e) {
              console.error('予約作成失敗', e);
              errors++;
            }
          }
        }
      }

      setMessage(`✅ 完了: 作成 ${created} / 既存 ${skipped} / 失敗 ${errors}`);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ 失敗: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(''), 7000);
    }
  };

  return (
    <div className="csv-bulk-wrap" style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
      <h4>CSV一括固定予約（週間定義 × 期間適用）</h4>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        CSV形式（ヘッダー任意）: <code>weekday,room,periods,title</code>
        例: <code>weekday,room,periods,title</code> / <code>月,小演習室1,1-3,英語演習</code>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy} title="CSVファイルを選択" />
        <label>開始日</label>
        <input type="date" value={rangeStart} onChange={e=>setRangeStart(e.target.value)} disabled={busy} title="適用開始日" />
        <label>終了日</label>
        <input type="date" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)} disabled={busy} title="適用終了日" />
        <label style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
          <input type="checkbox" checked={skipExisting} onChange={e=>setSkipExisting(e.target.checked)} disabled={busy} title="既存予約がある枠はスキップ" />
          既存はスキップ
        </label>
        <button onClick={handleApply} disabled={busy || rows.length === 0}>予約作成</button>
      </div>

      {message && <div style={{ marginTop: 8 }}>{message}</div>}

      {rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>プレビュー（{rows.length} 行）</div>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #eee' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #eee' }}>曜日</th>
                  <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #eee' }}>教室</th>
                  <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #eee' }}>時限</th>
                  <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #eee' }}>状態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding:'6px 8px', borderBottom:'1px solid #f5f5f5' }}>{weekdaysJp[r.weekday] ?? '-'}</td>
                    <td style={{ padding:'6px 8px', borderBottom:'1px solid #f5f5f5' }}>{r.roomName || r.roomKey}</td>
                    <td style={{ padding:'6px 8px', borderBottom:'1px solid #f5f5f5' }}>{r.periods.join(', ')}</td>
                    <td style={{ padding:'6px 8px', borderBottom:'1px solid #f5f5f5', color: r.error ? '#c00' : '#090' }}>
                      {r.error ? r.error : 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


