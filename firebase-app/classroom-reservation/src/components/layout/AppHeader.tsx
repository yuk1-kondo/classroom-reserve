import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { APP_VERSION } from '../../version';
import '../MainApp.css';

export type AppPage = 'classroom' | 'parking' | 'admin';

interface AppHeaderProps {
  title: string;
  current: AppPage;
  extraActions?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title, current, extraActions }) => {
  const { currentUser, isAdmin, loading: authLoading } = useAuth();
  const showAdmin = Boolean(currentUser && isAdmin && !authLoading);

  return (
    <header className="main-header">
      <h1>
        <img
          src={`${process.env.PUBLIC_URL}/logo_clear.png`}
          alt="校章"
          className="header-logo"
          width={32}
          height={32}
        />{' '}
        {title}
      </h1>
      <div className="header-info">
        <div className="system-info">v{APP_VERSION}</div>
        {current !== 'classroom' && (
          <Link to="/" className="admin-settings-link">
            教室予約
          </Link>
        )}
        {current !== 'parking' && (
          <Link to="/parking" className="admin-settings-link">
            駐車場予約
          </Link>
        )}
        {showAdmin && current !== 'admin' && (
          <Link to="/admin" className="admin-settings-link">
            管理・設定
          </Link>
        )}
        {extraActions}
      </div>
    </header>
  );
};

export default AppHeader;
