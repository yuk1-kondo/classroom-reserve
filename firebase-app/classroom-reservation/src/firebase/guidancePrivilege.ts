/**
 * 進路指導部など：会議室のみ先日付制限を免除する特例
 * Firestore: guidance_group_members/{uid}, system_settings/guidance_privilege
 */
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS, GUIDANCE_PRIVILEGE_DOC_ID } from '../constants/collections';

export interface GuidancePrivilegeSettings {
  meetingRoomId: string;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface GuidanceMemberRecord {
  uid: string;
  active?: boolean;
  note?: string;
  addedAt?: Timestamp;
}

export const guidancePrivilegeService = {
  async getMeetingRoomId(): Promise<string | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.SYSTEM_SETTINGS, GUIDANCE_PRIVILEGE_DOC_ID));
    if (!snap.exists()) return null;
    const id = (snap.data() as GuidancePrivilegeSettings | undefined)?.meetingRoomId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  },

  async isGuidanceMember(uid: string): Promise<boolean> {
    const snap = await getDoc(doc(db, COLLECTIONS.GUIDANCE_GROUP_MEMBERS, uid));
    if (!snap.exists()) return false;
    const d = snap.data() as { active?: boolean };
    return d.active !== false;
  },

  async upsertPrivilegeSettings(
    meetingRoomId: string,
    updatedBy: string
  ): Promise<void> {
    await setDoc(
      doc(db, COLLECTIONS.SYSTEM_SETTINGS, GUIDANCE_PRIVILEGE_DOC_ID),
      {
        meetingRoomId,
        updatedBy,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );
  },

  /** 管理者向け：メンバー一覧 */
  async listMembers(): Promise<GuidanceMemberRecord[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.GUIDANCE_GROUP_MEMBERS));
    return snap.docs.map(d => ({ uid: d.id, ...(d.data() as object) } as GuidanceMemberRecord));
  },

  async addMember(uid: string, addedBy: string): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.GUIDANCE_GROUP_MEMBERS, uid), {
      active: true,
      addedAt: Timestamp.now(),
      addedBy
    });
  },

  async removeMember(uid: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.GUIDANCE_GROUP_MEMBERS, uid));
  }
};
