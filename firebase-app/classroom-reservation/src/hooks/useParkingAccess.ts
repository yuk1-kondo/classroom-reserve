import { useCallback, useEffect, useState } from 'react';
import { ParkingAccessMode } from '../constants/parking';
import { parkingPrivilegeService, parkingSettingsService } from '../firebase/parking';

/**
 * 駐車場リンク／画面の権限。呼び出し元の useAuth 結果を渡すこと
 * （内部で useAuth すると onAuthStateChanged と教室キャッシュ破棄が二重になり、台帳初回取得と競合する）。
 */
export function useParkingAccess(
  uid: string | undefined,
  auth: { isAdmin: boolean; authReady: boolean }
) {
  const { isAdmin, authReady } = auth;
  const [accessMode, setAccessMode] = useState<ParkingAccessMode>('group');
  const [isMember, setIsMember] = useState(false);
  const [canDeleteOthers, setCanDeleteOthers] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!authReady) return;
    if (!uid) {
      setIsMember(false);
      setCanDeleteOthers(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const mode = await parkingSettingsService.getAccessMode();
      setAccessMode(mode);
      const rec = await parkingPrivilegeService.getMembership(uid);
      const member = !!rec && rec.active !== false;
      setIsMember(member);
      setCanDeleteOthers(member && rec?.canDelete === true);
    } catch {
      setAccessMode('group');
      setIsMember(false);
      setCanDeleteOthers(false);
    } finally {
      setLoading(false);
    }
  }, [uid, authReady]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canAccess = Boolean(uid) && (isAdmin || accessMode === 'public' || isMember);

  const canDeleteReservation = (createdBy?: string) => {
    if (!uid) return false;
    if (isAdmin) return true;
    if (createdBy && createdBy === uid) return true;
    return canDeleteOthers;
  };

  return {
    accessMode,
    isMember,
    canAccess,
    canDeleteOthers,
    canDeleteReservation,
    loading,
    refresh
  };
}
