import { useCallback, useEffect, useState } from 'react';
import { parkingPrivilegeService } from '../firebase/parking';

/**
 * 駐車場の削除権限。呼び出し元の useAuth 結果を渡すこと
 * （内部で useAuth すると onAuthStateChanged と教室キャッシュ破棄が二重になる）。
 * 画面への入場はログイン＋パスコード（ParkingApp）。データ権限は認証済みなら全員。
 */
export function useParkingAccess(
  uid: string | undefined,
  auth: { isAdmin: boolean; authReady: boolean }
) {
  const { isAdmin, authReady } = auth;
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
      const rec = await parkingPrivilegeService.getMembership(uid);
      const member = !!rec && rec.active !== false;
      setIsMember(member);
      setCanDeleteOthers(member && rec?.canDelete === true);
    } catch {
      setIsMember(false);
      setCanDeleteOthers(false);
    } finally {
      setLoading(false);
    }
  }, [uid, authReady]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canAccess = Boolean(uid);

  const canDeleteReservation = (createdBy?: string) => {
    if (!uid) return false;
    if (isAdmin) return true;
    if (createdBy && createdBy === uid) return true;
    return canDeleteOthers;
  };

  return {
    isMember,
    canAccess,
    canDeleteOthers,
    canDeleteReservation,
    loading,
    refresh
  };
}
