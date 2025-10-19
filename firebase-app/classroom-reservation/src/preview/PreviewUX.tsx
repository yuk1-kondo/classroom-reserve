import React, { useMemo, useState } from 'react';
import '../index.css';
import '../components/MainApp.css';
import '../components/CalendarComponent.css';
import '../components/DailyReservationTable.css';
import './PreviewUX.css';
import MainApp from '../components/MainApp';

function useQuery(): URLSearchParams {
  const [value] = useState(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''));
  return value;
}

export const PreviewUX: React.FC = () => {
  const query = useQuery();
  const today = useMemo(() => new Date(), []);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  const info = [
    '本ページは UX リファクタリングのプレビューです。',
    '機能は既存バックエンドを使用、見た目/操作性の変更点を確認できます。',
    '画面右上「予約管理」からフォームを開き、日付セルタップで日別表示を確認できます。'
  ];

  return (
    <div>
      <div className="ux-preview-banner">
        <strong>UX Preview</strong>
        <ul>
          {info.map((t, i) => (<li key={i}>{t}</li>))}
        </ul>
      </div>
      <MainApp />
    </div>
  );
};

export default PreviewUX;


