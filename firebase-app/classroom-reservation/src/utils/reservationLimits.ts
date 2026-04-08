/**
 * 予約の先日付制限（system_settings）をクライアントでスキップできるか。
 * Firestore ルールと同じ論理に揃えること。
 */
export function canBypassSystemReservationDateLimit(params: {
  isAdmin: boolean;
  isGuidanceMember: boolean;
  selectedRoomId: string;
  guidanceMeetingRoomId: string | null | undefined;
}): boolean {
  if (params.isAdmin) return true;
  if (!params.guidanceMeetingRoomId || !params.selectedRoomId) return false;
  return params.isGuidanceMember && params.selectedRoomId === params.guidanceMeetingRoomId;
}
