import React, { useEffect, useRef } from 'react';
import DailyReservationTable from './DailyReservationTable';
import './ReservationSheet.css';
import { MonthlyReservationsProvider } from '../contexts/MonthlyReservationsContext';
import { ReservationDataProvider } from '../contexts/ReservationDataContext';

interface ReservationSheetProps {
  date?: string;
  open: boolean;
  onClose: () => void;
  onOpenSidePanel: () => void;
}

const ReservationSheet: React.FC<ReservationSheetProps> = ({ date, open, onClose, onOpenSidePanel }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // body スクロールロック & フォーカス管理
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      document.body.classList.add('no-scroll');
      // 初期フォーカス
      setTimeout(() => {
        sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      }, 0);
    } else {
      document.body.classList.remove('no-scroll');
      // フォーカス戻す
      previouslyFocused.current?.focus?.();
    }
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [open]);

  // ESC / タブトラップ
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="reservation-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="reservationSheetTitle">
      <div className="reservation-sheet" ref={sheetRef} onClick={(e)=>e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true"></div>
        <div className="sheet-header">
          <span id="reservationSheetTitle">予約状況</span>
          <button type="button" data-autofocus onClick={onClose} aria-label="閉じる" className="sheet-close-btn">✕</button>
        </div>
        <div className="sheet-content">
          {date && (
            <MonthlyReservationsProvider>
              <ReservationDataProvider date={date}>
            <DailyReservationTable selectedDate={date} showWhenEmpty={true} />
              </ReservationDataProvider>
            </MonthlyReservationsProvider>
          )}
        </div>
        <div className="sheet-footer">
          <button type="button" className="sheet-action-btn" onClick={onOpenSidePanel}>この日の予約を追加・編集</button>
        </div>
      </div>
      <div className="reservation-sheet-backdrop" onClick={onClose} />
    </div>
  );
};

export default ReservationSheet;
