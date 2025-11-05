// ローディングスピナーコンポーネント
import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  message,
  fullScreen = false 
}) => {
  const content = (
    <div className={`loading-spinner-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className={`spinner ${size}`}>
        <div className="spinner-circle"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );

  return fullScreen ? (
    <div className="loading-overlay">
      {content}
    </div>
  ) : content;
};

export const SkeletonLoader: React.FC<{ 
  type?: 'text' | 'card' | 'list' | 'calendar';
  count?: number;
}> = ({ type = 'text', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="skeleton-card">
            <div className="skeleton-header">
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line skeleton-subtitle"></div>
            </div>
            <div className="skeleton-body">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
            </div>
          </div>
        );
      case 'list':
        return (
          <div className="skeleton-list-item">
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        );
      case 'calendar':
        return (
          <div className="skeleton-calendar">
            <div className="skeleton-line skeleton-calendar-header"></div>
            <div className="skeleton-calendar-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="skeleton-calendar-cell"></div>
              ))}
            </div>
          </div>
        );
      default:
        return <div className="skeleton-line"></div>;
    }
  };

  return (
    <div className="skeleton-container">
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {renderSkeleton()}
        </React.Fragment>
      ))}
    </div>
  );
};
