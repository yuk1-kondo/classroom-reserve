import { useCallback, useEffect, useState } from 'react';
import { sciencePrivilegeService } from '../firebase/sciencePrivilege';

export interface ScienceGroupMembershipSnapshot {
  isScienceMember: boolean;
}

/**
 * 理科グループ：`scienceGroupOnly` 教室の利用メンバーか。
 * refresh() は最新値を Promise で返す（予約直前の判定で React 状態の遅延を避ける）
 */
export function useScienceGroupMembership(uid: string | undefined) {
  const [isScienceMember, setIsScienceMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<ScienceGroupMembershipSnapshot> => {
    if (!uid) {
      setIsScienceMember(false);
      setLoading(false);
      return { isScienceMember: false };
    }
    setLoading(true);
    try {
      const member = await sciencePrivilegeService.isScienceMember(uid);
      setIsScienceMember(member);
      return { isScienceMember: member };
    } catch {
      setIsScienceMember(false);
      return { isScienceMember: false };
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isScienceMember, loading, refresh };
}
