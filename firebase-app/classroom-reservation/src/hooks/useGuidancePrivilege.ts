import { useCallback, useEffect, useState } from 'react';
import { guidancePrivilegeService } from '../firebase/guidancePrivilege';

/**
 * 進路指導部特例：会議室の roomId と、現在ユーザーがメンバーか。
 */
export function useGuidancePrivilege(uid: string | undefined) {
  const [meetingRoomId, setMeetingRoomId] = useState<string | null>(null);
  const [isGuidanceMember, setIsGuidanceMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!uid) {
      setMeetingRoomId(null);
      setIsGuidanceMember(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [mid, member] = await Promise.all([
        guidancePrivilegeService.getMeetingRoomId(),
        guidancePrivilegeService.isGuidanceMember(uid)
      ]);
      setMeetingRoomId(mid);
      setIsGuidanceMember(member);
    } catch {
      setMeetingRoomId(null);
      setIsGuidanceMember(false);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { meetingRoomId, isGuidanceMember, loading, refresh };
}
