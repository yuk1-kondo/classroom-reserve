import React, { useMemo, useState } from 'react';
import './CsvBulkReservations.css';
import { Timestamp } from 'firebase/firestore';
import { roomsService, reservationsService, PERIOD_ORDER, createDateTimeFromPeriod } from '../../firebase/firestore';
import { toDateStr } from '../../utils/dateRange';
import { displayLabel } from '../../utils/periodLabel';
import { useSystemSettings } from '../../hooks/useSystemSettings';

type RoomOption = { id: string; name: string };

type Props = {
  currentUserId?: string;
  roomOptions?: RoomOption[]; // 省略時は内部で取得
  isAdmin?: boolean; // 管理者フラグ
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

  const fullToHalfDigits = (s: string) => s.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));

function expandPeriods(cell: string): string[] {
  const fullToHalfDigits = (s: string) => s.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
  const raw = cell.split(',').map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const token of raw) {
    // 正規化: 全角→半角, "限"などの除去
    const norm = fullToHalfDigits(token).replace(/限/g, '').trim();
    if (norm.includes('-')) {
      const [a, b] = norm.split('-').map(s => s.trim());
      const startIdx = PERIOD_ORDER.indexOf(a as any);
      const endIdx = PERIOD_ORDER.indexOf(b as any);
      if (startIdx >= 0 && endIdx >= 0 && startIdx <= endIdx) {
        out.push(...PERIOD_ORDER.slice(startIdx, endIdx + 1));
      }
    } else {
      out.push(norm);
    }
  }
  // 正規化（重複除去）
  return Array.from(new Set(out));
}

// 連続する時限をグループ化（例: ["1","2","3","5"] → [["1","2","3"],["5"]])
function groupContiguousPeriods(periods: string[]): string[][] {
  const order = PERIOD_ORDER as readonly string[];
  // 警告: PERIOD_ORDER に含まれないものは無視される（これが原因で空になる可能性あり）
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

export default function CsvBulkReservations({ currentUserId, roomOptions, isAdmin = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewItem[]>([]);
  const { maxDateStr, limitMonths } = useSystemSettings();
  const [rangeStart, setRangeStart] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    // 管理者の場合はmaxDateStrを無視してデフォルト3ヶ月後
    if (maxDateStr && !isAdmin) return maxDateStr;
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
    // ① 同一(weekday, roomId/name, title)で時限をマージ
    const mergedMap: Record<string, PreviewItem> = {};
    for (const r of result) {
      const keyRoom = r.roomId ? `id:${r.roomId}` : `name:${r.roomKey}`;
      const keyTitle = (r.title || '').trim();
      const key = `${r.weekday}__${keyRoom}__${keyTitle}`;
      if (!mergedMap[key]) {
        mergedMap[key] = { ...r, periods: [...r.periods] };
      } else {
        mergedMap[key].periods = Array.from(new Set([...(mergedMap[key].periods || []), ...r.periods]));
        // エラーは厳しい方を維持
        mergedMap[key].error = mergedMap[key].error || r.error;
      }
    }
    const merged = Object.values(mergedMap);

    setRows(merged);
  };

  const handleApply = async () => {
    if (!currentUserId) { alert('管理者でログインしてください'); return; }
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) { alert('期間を正しく指定してください'); return; }
    
    // システム上限の強制適用（管理者の場合はスキップ）
    let effectiveEnd = rangeEnd;
    if (!isAdmin && maxDateStr && rangeEnd > maxDateStr) {
      effectiveEnd = maxDateStr;
    }

    if (rows.length === 0) { alert('CSVを読み込んでください'); return; }
    const hasError = rows.some(r => r.error);
    if (hasError) { alert('CSVにエラーがあります。修正してください'); return; }

    try {
      setBusy(true); setMessage('予約作成中...');
      const dates = iterateDates(rangeStart, effectiveEnd);
      console.log(`📅 CSV一括予約開始: 期間 ${rangeStart} 〜 ${effectiveEnd} (${dates.length}日間), CSV行数: ${rows.length}`);
      let created = 0; let skipped = 0; let errors = 0;
      const errorDetails: string[] = [];
      let matchedRows = 0;

      for (const d of dates) {
        const ymd = toDateStr(d); // ローカル日付で固定（ISOで日付が前日にずれる問題を回避）
        const dayReservations = await reservationsService.getDayReservations(d);

        for (const row of rows) {
          if (d.getDay() !== row.weekday) continue;
          matchedRows++; // デバッグ用カウント
          const roomId = row.roomId!;
          
          // 連続時限はまとめて1予約にする
          const groups = groupContiguousPeriods(row.periods);
          if (groups.length === 0 && row.periods.length > 0) {
            // periodsはあるのにgroupsが空 = すべて不正な時限
            errors++;
            errorDetails.push(`${ymd} ${row.roomName} ${row.periods.join(',')}: 不正な時限コード（システム定義外）`);
            continue;
          }

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
            if (!dtStart || !dtEnd) { 
              errors++; 
              errorDetails.push(`${ymd} ${row.roomName || roomId} ${first}-${last}: 時限の日時作成失敗`);
              continue; 
            }
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
            } catch (e: any) {
              console.error('予約作成失敗', e);
              errors++;
              const errorMsg = e?.message || String(e);
              errorDetails.push(`${ymd} ${row.roomName || roomId} ${periodStr}: ${errorMsg}`);
            }
          }
        }
      }

      console.log(`📊 CSV一括予約完了: 作成 ${created} / 既存 ${skipped} / 失敗 ${errors}`);
      if (errors > 0 && errorDetails.length > 0) {
        console.error('エラー詳細:', errorDetails.slice(0, 10)); // 最初の10件のみ
      }
      
      let messageText = `✅ 完了: 作成 ${created} / 既存 ${skipped} / 失敗 ${errors}`;
      if (created === 0 && skipped === 0 && errors === 0) {
         if (matchedRows === 0) {
            messageText += `\n⚠️ 期間内に該当する曜日のデータがありませんでした。\n期間: ${rangeStart}〜${effectiveEnd}, CSV行数: ${rows.length}`;
         } else {
            messageText += `\n⚠️ データはありましたが処理されませんでした (マッチ回数: ${matchedRows})。\n時限コードが正しいか確認してください。`;
         }
      } else if (created === 0 && skipped > 0) {
        messageText += '\n⚠️ すべて既存予約のためスキップされました。';
      }
      if (errors > 0) {
        messageText += `\n❌ エラー: ${errorDetails.slice(0, 3).join('; ')}${errorDetails.length > 3 ? '...' : ''}`;
      }
      setMessage(messageText);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ 失敗: ${e?.message || '不明なエラー'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(''), 7000);
    }
  };

  return (
    <div className="csvb-wrap">
      <h4>CSV一括固定予約（週間定義 × 期間適用）</h4>
      <div className="csvb-help">
        CSV形式（ヘッダー任意）: <code>weekday,room,periods,title</code>
        例: <code>weekday,room,periods,title</code> / <code>月,小演習室1,1-3,英語演習</code>
      </div>
      <div className="csvb-controls">
        <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy} title="CSVファイルを選択" />
        <label>開始日</label>
        <input type="date" value={rangeStart} onChange={e=>setRangeStart(e.target.value)} disabled={busy} title="適用開始日" />
        <label>終了日</label>
        <input type="date" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)} disabled={busy} title="適用終了日" />
        <label className="csvb-inline-check">
          <input type="checkbox" checked={skipExisting} onChange={e=>setSkipExisting(e.target.checked)} disabled={busy} title="既存予約がある枠はスキップ" />
          既存はスキップ
        </label>
        <button onClick={handleApply} disabled={busy || rows.length === 0}>予約作成</button>
      </div>

      {message && <div className="csvb-message">{message}</div>}

      {rows.length > 0 && (
        <div className="csvb-preview">
          <div className="csvb-preview-title">プレビュー（{rows.length} 行）</div>
          <div className="csvb-preview-scroll">
            <table className="csvb-table">
              <thead>
                <tr>
                  <th className="csvb-th">曜日</th>
                  <th className="csvb-th">教室</th>
                  <th className="csvb-th">時限</th>
                  <th className="csvb-th">状態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="csvb-td">{weekdaysJp[r.weekday] ?? '-'}</td>
                    <td className="csvb-td">{r.roomName || r.roomKey}</td>
                    <td className="csvb-td">{r.periods.join(', ')}</td>
                    <td className={`csvb-td csvb-status ${r.error ? 'error' : 'ok'}`}>
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



