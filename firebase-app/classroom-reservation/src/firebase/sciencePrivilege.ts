/**
 * 理科グループ：`rooms.scienceGroupOnly` 教室の利用メンバー
 * Firestore: science_group_members/{uid}
 */
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS } from '../constants/collections';

export interface ScienceMemberRecord {
  uid: string;
  active?: boolean;
  note?: string;
  addedAt?: Timestamp;
}

/** Firestore ルール isScienceGroupMember と同じ：active が明示的に false のときだけ無効 */
export function isScienceMembershipActive(data: { active?: boolean }): boolean {
  return data.active !== false;
}

export const sciencePrivilegeService = {
  async isScienceMember(uid: string): Promise<boolean> {
    const snap = await getDoc(doc(db, COLLECTIONS.SCIENCE_GROUP_MEMBERS, uid));
    if (!snap.exists()) return false;
    return isScienceMembershipActive(snap.data() as { active?: boolean });
  },

  /** 管理者向け：メンバー一覧 */
  async listMembers(): Promise<ScienceMemberRecord[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.SCIENCE_GROUP_MEMBERS));
    return snap.docs.map(d => ({ uid: d.id, ...(d.data() as object) } as ScienceMemberRecord));
  },

  async addMember(uid: string, addedBy: string): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.SCIENCE_GROUP_MEMBERS, uid), {
      active: true,
      addedAt: Timestamp.now(),
      addedBy
    });
  },

  async removeMember(uid: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.SCIENCE_GROUP_MEMBERS, uid));
  }
};
