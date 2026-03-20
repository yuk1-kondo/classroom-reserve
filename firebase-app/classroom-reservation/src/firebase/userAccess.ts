import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';

export type UserStatus = 'allowed' | 'blocked';

export interface UserAccessRecord {
  uid: string;
  email: string;
  displayName: string | null;
  status: UserStatus;
  firstSeenAt: Timestamp;
  lastSeenAt: Timestamp;
}

export const userAccessService = {
  /**
   * ログイン時に user_access を upsert（初回は allowed で作成、以降は lastSeenAt 更新）
   */
  async upsertOnLogin(uid: string, email: string, displayName: string | null): Promise<UserStatus> {
    try {
      const ref = doc(db, 'user_access', uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data() as UserAccessRecord;
        await setDoc(ref, {
          lastSeenAt: Timestamp.now(),
          displayName: displayName || data.displayName || null,
          email
        }, { merge: true });
        return data.status;
      }

      await setDoc(ref, {
        uid,
        email,
        displayName: displayName || null,
        status: 'allowed' as UserStatus,
        firstSeenAt: Timestamp.now(),
        lastSeenAt: Timestamp.now()
      });
      return 'allowed';
    } catch (e) {
      console.error('user_access upsert 失敗:', e);
      return 'allowed';
    }
  },

  /**
   * ユーザーのステータスを取得（ドキュメントが無ければ allowed 扱い）
   */
  async getUserStatus(uid: string): Promise<UserStatus> {
    try {
      const snap = await getDoc(doc(db, 'user_access', uid));
      if (snap.exists()) {
        return (snap.data() as UserAccessRecord).status;
      }
      return 'allowed';
    } catch {
      return 'allowed';
    }
  },

  /**
   * 全ユーザー一覧を取得（管理画面用）
   */
  async getAllUsers(): Promise<UserAccessRecord[]> {
    try {
      const snapshot = await getDocs(collection(db, 'user_access'));
      return snapshot.docs
        .map(d => d.data() as UserAccessRecord)
        .sort((a, b) => {
          const aMs = a.lastSeenAt?.toMillis?.() ?? 0;
          const bMs = b.lastSeenAt?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
    } catch (e) {
      console.error('user_access 一覧取得失敗:', e);
      return [];
    }
  },

  /**
   * ステータスを更新（管理者操作: allowed ⇔ blocked）
   */
  async updateUserStatus(uid: string, status: UserStatus): Promise<void> {
    await setDoc(doc(db, 'user_access', uid), { status }, { merge: true });
  },

  /**
   * ユーザーレコードを削除（管理者操作）
   */
  async deleteUser(uid: string): Promise<void> {
    await deleteDoc(doc(db, 'user_access', uid));
  },

  /**
   * user_profiles から user_access に未登録ユーザーを一括取り込み
   * （過去にログインしたユーザーを管理画面に反映するための初回同期用）
   * @returns 新規追加された件数
   */
  async syncFromUserProfiles(): Promise<number> {
    try {
      const [profilesSnap, accessSnap] = await Promise.all([
        getDocs(collection(db, 'user_profiles')),
        getDocs(collection(db, 'user_access'))
      ]);

      const existingUids = new Set(accessSnap.docs.map(d => d.id));
      let added = 0;

      for (const profDoc of profilesSnap.docs) {
        if (existingUids.has(profDoc.id)) continue;

        const data = profDoc.data();
        const email = String(data.email || '');
        if (!email) continue;

        await setDoc(doc(db, 'user_access', profDoc.id), {
          uid: profDoc.id,
          email,
          displayName: data.displayName || null,
          status: 'allowed' as UserStatus,
          firstSeenAt: data.updatedAt || Timestamp.now(),
          lastSeenAt: data.updatedAt || Timestamp.now()
        });
        added++;
      }

      return added;
    } catch (e) {
      console.error('user_profiles → user_access 同期失敗:', e);
      return 0;
    }
  }
};
