import React from 'react';
import '../index.css';
import '../components/MainApp.css';
import '../components/CalendarComponent.css';
import '../components/DailyReservationTable.css';
import './PreviewUX.css';
import MainApp from '../components/MainApp';

export const PreviewUX: React.FC = () => {
  return (
    <div>
      <div className="ux-preview-banner">
        <strong>UX Preview</strong>
      </div>
      <MainApp />
    </div>
  );
};

export default PreviewUX;


