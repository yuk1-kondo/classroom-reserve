/**
 * 管理・設定 — 左ナビで項目を選び、右ペインに内容を表示
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { roomsService, Room } from '../firebase/firestore';
import ReservationLimitSettings from './admin/ReservationLimitSettings';
import PasscodeSettings from './admin/PasscodeSettings';
import BlockedPeriodsSettings from './admin/BlockedPeriodsSettings';
import RecurringTemplatesWorkspace from './admin/RecurringTemplatesWorkspace';
import UserAccessManager from './admin/UserAccessManager';
import { APP_VERSION } from '../version';
import './admin/admin-settings-blocks.css';
import './AdminPage.css';

export type AdminSectionId =
  | 'reservation-limit'
  | 'passcode'
  | 'blocked-periods'
  | 'templates'
  | 'users';

const SECTION_DEF: {
  id: AdminSectionId;
  label: string;
  superOnly?: boolean;
  description: string;
}[] = [
  { id: 'reservation-limit', label: '予約制限', description: '予約の最終日（固定日）を設定します。' },
  { id: 'passcode', label: '会議室・図書館パスコード', description: '会議室・図書館の予約削除用パスコードを設定します。' },
  { id: 'blocked-periods', label: '予約禁止期間', description: '予約できない期間を登録します。' },
  {
    id: 'templates',
    label: '固定予約テンプレート',
    superOnly: true,
    description: 'テンプレートの編集・実予約への適用・CSV・一括削除です。',
  },
  { id: 'users', label: 'ユーザー管理', superOnly: true, description: 'アクセス許可・管理者権限の管理です。' },
];

const AdminPage: React.FC = () => {
  const { currentUser, isAdmin, isSuperAdmin, loading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await roomsService.getAllRooms();
        if (!cancelled) setRooms(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setRooms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const roomOptions = useMemo(
    () => rooms.filter(r => !!r.id).map(r => ({ id: r.id as string, name: r.name })),
    [rooms]
  );

  /** 実際に開ける項目（スーパー専用はスーパーのみ） */
  const accessibleSectionIds = useMemo(
    () => SECTION_DEF.filter(s => !s.superOnly || isSuperAdmin).map(s => s.id),
    [isSuperAdmin]
  );

  const sectionParam = searchParams.get('section') as AdminSectionId | null;

  const activeSection: AdminSectionId = useMemo(() => {
    if (sectionParam && accessibleSectionIds.includes(sectionParam)) {
      return sectionParam;
    }
    return accessibleSectionIds[0] ?? 'reservation-limit';
  }, [sectionParam, accessibleSectionIds]);

  useEffect(() => {
    const valid = sectionParam && accessibleSectionIds.includes(sectionParam);
    if (!valid) {
      setSearchParams({ section: activeSection }, { replace: true });
    }
  }, [sectionParam, accessibleSectionIds, activeSection, setSearchParams]);

  const activeMeta = useMemo(
    () => SECTION_DEF.find(s => s.id === activeSection) ?? SECTION_DEF[0],
    [activeSection]
  );

  const isSectionLocked = (item: (typeof SECTION_DEF)[number]) =>
    Boolean(item.superOnly && !isSuperAdmin);

  if (loading) {
    return (
      <div className="admin-page admin-page--loading">
        <p>読み込み中…</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <header className="admin-page__header">
          <Link to="/" className="admin-page__back">
            ← トップへ戻る
          </Link>
        </header>
        <div className="admin-page__denied">
          <h1>アクセスできません</h1>
          <p>この画面は管理者のみが利用できます。</p>
        </div>
      </div>
    );
  }

  const selectSection = (id: AdminSectionId) => {
    const def = SECTION_DEF.find(s => s.id === id);
    if (def && isSectionLocked(def)) return;
    setSearchParams({ section: id }, { replace: false });
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div className="admin-page__brand">
          <img
            src={`${process.env.PUBLIC_URL}/logo_clear.png`}
            alt=""
            className="admin-page__logo"
            width={32}
            height={32}
          />
          <div>
            <h1 className="admin-page__title">管理・設定</h1>
          </div>
        </div>
        <div className="admin-page__actions">
          <span className="admin-page__version">v{APP_VERSION}</span>
          <Link to="/" className="admin-page__home-link">
            予約画面に戻る
          </Link>
        </div>
      </header>

      <main className="admin-page__main">
        <div className="admin-page__layout">
          <nav className="admin-page__nav" aria-label="設定メニュー">
            <ul className="admin-page__nav-list">
              {SECTION_DEF.map(item => {
                const locked = isSectionLocked(item);
                const isActive = !locked && item.id === activeSection;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={
                        locked
                          ? 'admin-page__nav-btn admin-page__nav-btn--locked'
                          : isActive
                            ? 'admin-page__nav-btn admin-page__nav-btn--active'
                            : 'admin-page__nav-btn'
                      }
                      disabled={locked}
                      onClick={() => selectSection(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={locked ? 'スーパー管理者のみ利用できます' : undefined}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section
            className="admin-page__panel"
            aria-labelledby="admin-settings-panel-title"
          >
            <header className="admin-page__panel-head">
              <h2 id="admin-settings-panel-title" className="admin-page__panel-title">
                {activeMeta?.label}
              </h2>
              {activeMeta?.description && (
                <p className="admin-page__panel-desc">{activeMeta.description}</p>
              )}
            </header>

            <div className="admin-page__panel-body">
              {activeSection === 'reservation-limit' && (
                <ReservationLimitSettings currentUserId={currentUser?.uid} hideTitle />
              )}
              {activeSection === 'passcode' && (
                <PasscodeSettings currentUserId={currentUser?.uid} hideTitle />
              )}
              {activeSection === 'blocked-periods' && (
                <BlockedPeriodsSettings
                  currentUserId={currentUser?.uid}
                  roomOptions={roomOptions}
                  hideTitle
                />
              )}
              {activeSection === 'templates' && isSuperAdmin && (
                <RecurringTemplatesWorkspace
                  isAdmin={isSuperAdmin}
                  currentUserId={currentUser?.uid}
                  roomOptions={roomOptions}
                />
              )}
              {activeSection === 'users' && isSuperAdmin && <UserAccessManager hideTitle />}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
