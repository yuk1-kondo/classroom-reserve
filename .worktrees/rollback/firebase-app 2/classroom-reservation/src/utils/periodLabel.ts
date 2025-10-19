// 時限表示統一ユーティリティ
// 既存データに "Lunch限" "after限" など揺れがあるため、ここで正規化する

export function displayLabel(period: string): string {
  const raw = (period || '').trim();
  const base = raw.replace(/限$/,''); // 末尾の「限」を一旦除去して判定
  if (base === 'lunch' || /lunch/i.test(base)) return '昼休み';
  if (base === 'after' || /after/i.test(base)) return '放課後';
  if (/^\d+$/.test(base)) return `${base}限`;
  return raw; // 想定外はそのまま
}

export function canonicalizeSinglePeriod(period: string, periodName?: string): string | undefined {
  const raw = (periodName || period || '').toString().trim();
  const base = raw.replace(/限$/,'');
  if (period === 'lunch' || /lunch/i.test(base)) return '昼休み';
  if (period === 'after' || /after/i.test(base)) return '放課後';
  return (/^\d+$/.test(base) ? undefined : periodName);
}

export function formatPeriodDisplay(period: string, periodName?: string): string {
  // periodName に fallback 用の英語+限が含まれるケース(lunch限 等)を先に正規化
  if (periodName && /lunch限|after限/i.test(periodName)) {
    periodName = periodName.replace(/lunch限/gi, '昼休み').replace(/after限/gi, '放課後');
  }
  let raw = period
    .replace(/lunch限/gi, 'lunch')
    .replace(/after限/gi, 'after');
  // 個別（単一）の場合
  if (!raw.includes(',') && !raw.includes('-')) {
    return displayLabel(raw);
  }
  const labelForCode = (code: string) => displayLabel(code); // 数値/昼休み/放課後 へ正規化
  // カンマ列（1,2,3 / 4,lunch / lunch,5 / 5,6,7,after など）
  if (raw.includes(',')) {
    const list = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (list.length === 1) return labelForCode(list[0]);
    const start = list[0];
    const end = list[list.length - 1];
    let out = `${labelForCode(start)}〜${labelForCode(end)}`;
    // 事後防御: 生成結果に英語+限 が残っていれば再置換
    out = out
      .replace(/lunch限/gi, '昼休み')
      .replace(/after限/gi, '放課後');
    return out;
  }
  // ハイフン範囲（1-lunch / lunch-5 / 5-after 等）
  if (raw.includes('-')) {
    const [start, end] = raw.split('-').map(s => s.trim());
    let out = `${labelForCode(start)}〜${labelForCode(end)}`;
    out = out
      .replace(/lunch限/gi, '昼休み')
      .replace(/after限/gi, '放課後');
    return out;
  }
  return displayLabel(raw);
}

// CSV等で使用する統一ラベル
// 単一: そのまま displayLabel
// 複数(カンマ/ハイフン): 範囲表示を formatPeriodDisplay で構築
export function labelForCsv(period: string, periodName?: string): string {
  if (period.includes(',') || period.includes('-')) {
    return formatPeriodDisplay(period, periodName);
  }
  return displayLabel(period);
}
