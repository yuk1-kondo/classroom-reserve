import { useCallback, useEffect, useState } from 'react';
import { guidancePrivilegeService } from '../firebase/guidancePrivilege';

export interface GuidancePrivilegeSnapshot {
  meetingRoomId: string | null;
  isGuidanceMember: boolean;
}

/**
 * 進路指導部特例：会議室の roomId と、現在ユーザーがメンバーか。
 * refresh() は最新値を Promise で返す（予約直前の判定で React 状態の遅延を避ける）
 */
export function useGuidancePrivilege(uid: string | undefined) {
  const [meetingRoomId, setMeetingRoomId] = useState<string | null>(null);
  const [isGuidanceMember, setIsGuidanceMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<GuidancePrivilegeSnapshot> => {
    if (!uid) {
      setMeetingRoomId(null);
      setIsGuidanceMember(false);
      setLoading(false);
      return { meetingRoomId: null, isGuidanceMember: false };
    }
    setLoading(true);
    try {
      const [mid, member] = await Promise.all([
        guidancePrivilegeService.getMeetingRoomId(),
        guidancePrivilegeService.isGuidanceMember(uid)
      ]);
      setMeetingRoomId(mid);
      setIsGuidanceMember(member);
      return { meetingRoomId: mid, isGuidanceMember: member };
    } catch {
      setMeetingRoomId(null);
      setIsGuidanceMember(false);
      return { meetingRoomId: null, isGuidanceMember: false };
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { meetingRoomId, isGuidanceMember, loading, refresh };
}
