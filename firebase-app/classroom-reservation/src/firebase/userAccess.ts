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

/** 管理者が一覧から削除した UID（user_profiles 同期で再取り込みしない） */
export interface UserAccessExclusionRecord {
  uid: string;
  excludedAt: Timestamp;
  excludedBy: string | null;
}

const exclusionsCollection = 'user_access_exclusions';

async function getExcludedUidSet(): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, exclusionsCollection));
    return new Set(snap.docs.map(d => d.id));
  } catch {
    return new Set();
  }
}

export const userAccessService = {
  /**
   * ログイン時に user_access を upsert（初回は allowed で作成、以降は lastSeenAt 更新）
   * user_access_exclusions に載っている UID は再登録せず blocked 扱い
   */
  async upsertOnLogin(uid: string, email: string, displayName: string | null): Promise<UserStatus> {
    try {
      const exclRef = doc(db, exclusionsCollection, uid);
      const exclSnap = await getDoc(exclRef);
      if (exclSnap.exists()) {
        const ref = doc(db, 'user_access', uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await setDoc(
            ref,
            {
              lastSeenAt: Timestamp.now(),
              displayName: displayName || (snap.data() as UserAccessRecord).displayName || null,
              email,
              status: 'blocked' as UserStatus
            },
            { merge: true }
          );
        }
        return 'blocked';
      }

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
   * ユーザーのステータスを取得（除外 UID は blocked）
   */
  async getUserStatus(uid: string): Promise<UserStatus> {
    try {
      const excl = await getDoc(doc(db, exclusionsCollection, uid));
      if (excl.exists()) return 'blocked';

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
   * user_access_exclusions に記録し、同期・ログインでの再作成を防ぐ
   */
  async deleteUser(uid: string, excludedBy?: string | null): Promise<void> {
    await deleteDoc(doc(db, 'user_access', uid));
    await setDoc(doc(db, exclusionsCollection, uid), {
      uid,
      excludedAt: Timestamp.now(),
      excludedBy: excludedBy ?? null
    });
  },

  /**
   * 除外を解除（管理者のみ）。次回ログインまたは同期で user_access に戻る。
   */
  async clearAccessExclusion(uid: string): Promise<void> {
    await deleteDoc(doc(db, exclusionsCollection, uid));
  },

  /**
   * user_profiles から user_access に未登録ユーザーを一括取り込み
   * user_access_exclusions の UID はスキップ
   */
  async syncFromUserProfiles(): Promise<number> {
    try {
      const [profilesSnap, accessSnap, excludedUids] = await Promise.all([
        getDocs(collection(db, 'user_profiles')),
        getDocs(collection(db, 'user_access')),
        getExcludedUidSet()
      ]);

      const existingUids = new Set(accessSnap.docs.map(d => d.id));
      let added = 0;

      for (const profDoc of profilesSnap.docs) {
        if (existingUids.has(profDoc.id)) continue;
        if (excludedUids.has(profDoc.id)) continue;

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
