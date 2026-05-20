import React, { useEffect, useMemo, useRef, useState } from 'react';
import './QrReception.css';

type Participant = {
  id: string;
  name: string;
};

const defaultParticipants: Participant[] = [
  { id: '1001', name: '山田 太郎' },
  { id: '1002', name: '佐藤 花子' },
  { id: '1003', name: '鈴木 一郎' }
];

function parseCsv(input: string): Participant[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, name] = line.split(',').map((col) => col.trim());
      return { id, name };
    })
    .filter((row) => row.id && row.name) as Participant[];
}

const QrReception: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>(defaultParticipants);
  const [csvInput, setCsvInput] = useState('1001,山田 太郎\n1002,佐藤 花子\n1003,鈴木 一郎');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('QRコードを読み取ってください');
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const participantsMap = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((participant) => {
      map.set(participant.id, participant.name);
    });
    return map;
  }, [participants]);

  const scannedName = lastScannedCode ? participantsMap.get(lastScannedCode) : '';

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleScan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = scanInputRef.current?.value.trim() || '';
    if (!code) return;

    setLastScannedCode(code);
    setScannedAt(new Date().toLocaleTimeString('ja-JP'));

    if (participantsMap.has(code)) {
      setStatusMessage('受付完了です');
    } else {
      setStatusMessage('登録が見つかりません（名簿を確認してください）');
    }

    if (scanInputRef.current) {
      scanInputRef.current.value = '';
      scanInputRef.current.focus();
    }
  };

  const handleApplyCsv = () => {
    const parsed = parseCsv(csvInput);
    if (!parsed.length) {
      setStatusMessage('CSV形式を確認してください（例: 1001,山田 太郎）');
      return;
    }
    setParticipants(parsed);
    setStatusMessage(`名簿を更新しました（${parsed.length}件）`);
    scanInputRef.current?.focus();
  };

  return (
    <div className="qr-reception-page" onClick={() => scanInputRef.current?.focus()}>
      <h1>QR受付フロント</h1>
      <p className="lead">USBバーコードリーダーでQRを読むと、番号と名前を表示します。</p>

      <section className="card">
        <h2>1) 名簿設定（ID,名前）</h2>
        <textarea
          value={csvInput}
          onChange={(e) => setCsvInput(e.target.value)}
          rows={6}
          placeholder={'1001,山田 太郎\n1002,佐藤 花子'}
        />
        <button type="button" onClick={handleApplyCsv}>
          名簿を反映
        </button>
      </section>

      <section className="card">
        <h2>2) QR読み取り</h2>
        <form onSubmit={handleScan}>
          <input
            ref={scanInputRef}
            type="text"
            inputMode="numeric"
            autoFocus
            placeholder="QRを読み取ると自動入力されます"
            aria-label="QR入力"
          />
        </form>
        <div className={`result ${scannedName ? 'ok' : lastScannedCode ? 'ng' : ''}`}>
          <p><strong>番号:</strong> {lastScannedCode || '---'}</p>
          <p><strong>名前:</strong> {scannedName || (lastScannedCode ? '未登録' : '---')}</p>
          <p className="status">{statusMessage}</p>
          {scannedAt && <p className="time">読み取り時刻: {scannedAt}</p>}
        </div>
      </section>
    </div>
  );
};

export default QrReception;
