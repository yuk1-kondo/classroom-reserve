// 管理者権限管理サービス
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query,
  where,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';

export const SUPER_ADMIN_EMAIL = '212-schooladmin@e.osakamanabi.jp';

// 管理者ユーザーの型定義
export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
  assignedAt: Timestamp;
  assignedBy: string;
  // 管理者の階層: 'super'（最初の管理者） or 'regular'（追加管理者）
  tier?: 'super' | 'regular';
}

// 管理者権限管理サービス
export const adminService = {
  // 管理者かどうかチェック（UID優先 + メールIDも許容）
  async isAdmin(uid: string, email?: string | null): Promise<boolean> {
    try {
      console.log('🔍 管理者権限チェック:', { uid, email });
      // 1) uid ドキュメント
      const uidDoc = await getDoc(doc(db, 'admin_users', uid));
      if (uidDoc.exists()) {
        console.log('🔍 管理者権限結果: true (by uid)');
        return true;
      }
      // 2) email ドキュメント（メールをドキュメントIDとしても許可）
      if (email) {
        const emailDoc = await getDoc(doc(db, 'admin_users', email));
        if (emailDoc.exists()) {
          console.log('🔍 管理者権限結果: true (by email)');
          return true;
        }
        // 3) 過去データ互換: メールを生成ID化したキー
        const legacyId = this.generateUidFromEmail(email);
        const legacyDoc = await getDoc(doc(db, 'admin_users', legacyId));
        if (legacyDoc.exists()) {
          console.log('🔍 管理者権限結果: true (by legacyId-from-email)');
          return true;
        }
        // 4) 全admin_usersをスキャンしてemailフィールドでマッチング（最後の手段）
        const allAdmins = await this.getAdminUsers();
        const emailMatch = allAdmins.find(admin => admin.email === email);
        if (emailMatch) {
          console.log('🔍 管理者権限結果: true (by email field scan)');
          return true;
        }
      }
      console.log('🔍 管理者権限結果: false');
      return false;
    } catch (error) {
      console.error('❌ 管理者チェックエラー:', error);
      return false;
    }
  },
  
  // 管理者リストを取得
  async getAdminUsers(): Promise<AdminUser[]> {
    try {
      console.log('📋 管理者リスト取得開始');
      const snapshot = await getDocs(collection(db, 'admin_users'));
      // 取得 → uid 基準で重複排除（emailキー・legacyキーの重複を除去）
      const raw = snapshot.docs.map(d => ({
        docId: d.id,
        ...(d.data() as any)
      }));
      // スーパー管理者の uid を特定（email ドキュメントが存在する前提）
      let superAdminUid: string | undefined;
      const superDoc = raw.find(r => r.docId === SUPER_ADMIN_EMAIL);
      if (superDoc && typeof (superDoc as any).uid === 'string') {
        superAdminUid = String((superDoc as any).uid);
      }

      const byUid = new Map<string, AdminUser>();
      for (const r of raw) {
        const key = String((r as any).uid || r.docId);
        const existing = byUid.get(key);
        const candidate: AdminUser = {
          uid: String((r as any).uid || r.docId),
          email: String((r as any).email || ''),
          role: 'admin',
          assignedAt: (r as any).assignedAt || Timestamp.now(),
          assignedBy: String((r as any).assignedBy || 'unknown'),
          tier: (r as any).tier
        };
        // スーパー管理者のメールを補完
        if (!candidate.email && superAdminUid && candidate.uid === superAdminUid) {
          candidate.email = SUPER_ADMIN_EMAIL;
          candidate.tier = 'super';
        }
        // 既存があれば、tier が super の方 / 早い assignedAt を優先
        if (!existing) {
          byUid.set(key, candidate);
        } else {
          const pickSuper = (existing.tier ?? 'regular') === 'super' ? existing : candidate;
          const other = pickSuper === existing ? candidate : existing;
          const picked = (pickSuper.tier ?? 'regular') === 'super' ? pickSuper : other;
          // 早い assignedAt を優先
          const exMs = (existing.assignedAt as any)?.toMillis?.() ?? 9e15;
          const caMs = (candidate.assignedAt as any)?.toMillis?.() ?? 9e15;
          const earlier = exMs <= caMs ? existing : candidate;
          byUid.set(key, (picked === pickSuper ? picked : earlier));
        }
      }

      // 昇順並び（assignedAt）
      const adminUsers = Array.from(byUid.values()).sort((a, b) => {
        const am = (a.assignedAt as any)?.toMillis?.() ?? 0;
        const bm = (b.assignedAt as any)?.toMillis?.() ?? 0;
        return am - bm;
      });
      
      console.log('📋 管理者リスト取得完了:', adminUsers.length, '件');
      return adminUsers;
    } catch (error) {
      console.error('❌ 管理者リスト取得エラー:', error);
      return [];
    }
  },
  
  // 管理者を追加
  async addAdmin(uid: string, email: string, assignedBy: string): Promise<boolean> {
    try {
      console.log('➕ 管理者追加開始:', { uid, email, assignedBy });
      
      // 既に管理者かチェック
      const existingAdmin = await this.isAdmin(uid);
      if (existingAdmin) {
        console.warn('⚠️ 既に管理者です:', uid);
        throw new Error('このユーザーは既に管理者です');
      }
      
      // uid ドキュメント
      await setDoc(doc(db, 'admin_users', uid), {
        uid,
        email,
        role: 'admin',
        assignedAt: Timestamp.now(),
        assignedBy,
        tier: 'regular'
      });

      // email ドキュメント（対称参照用。権限判定に使用される場合がある）
      await setDoc(doc(db, 'admin_users', email), {
        uid,
        email,
        role: 'admin',
        assignedAt: Timestamp.now(),
        assignedBy,
        tier: 'regular'
      });
      
      console.log('✅ 管理者追加完了:', uid);
      return true;
    } catch (error) {
      console.error('❌ 管理者追加エラー:', error);
      throw error;
    }
  },
  
  // 管理者を削除
  async removeAdmin(uid: string): Promise<boolean> {
    try {
      console.log('➖ 管理者削除開始:', uid);
      
      // 管理者かチェック
      const isAdmin = await this.isAdmin(uid);
      if (!isAdmin) {
        console.warn('⚠️ 管理者ではありません:', uid);
        throw new Error('このユーザーは管理者ではありません');
      }
      
      // uid ドキュメントを削除
      const uidRef = doc(db, 'admin_users', uid);
      const uidSnap = await getDoc(uidRef);
      let email: string | undefined;
      if (uidSnap.exists()) {
        const d = uidSnap.data() as AdminUser;
        email = d.email;
        // スーパー管理者は削除不可
        if (email === SUPER_ADMIN_EMAIL) {
          throw new Error('初期管理者は削除できません');
        }
        // 念のため uid がスーパー管理者の uid でも拒否
        if (!email) {
          const superRef = doc(db, 'admin_users', SUPER_ADMIN_EMAIL);
          const superSnap = await getDoc(superRef);
          if (superSnap.exists()) {
            const su = superSnap.data() as any;
            if (String(su.uid) === uid) {
              throw new Error('初期管理者は削除できません');
            }
          }
        }
      }
      await deleteDoc(uidRef);
      // email ドキュメントも削除（存在していれば）
      if (email) {
        await deleteDoc(doc(db, 'admin_users', email));
      }
      
      console.log('✅ 管理者削除完了:', uid);
      return true;
    } catch (error) {
      console.error('❌ 管理者削除エラー:', error);
      throw error;
    }
  },

  // スーパー管理者かどうか
  async isSuperAdmin(uid: string, email?: string | null): Promise<boolean> {
    try {
      // 固定スーパー管理者（運用都合）
      if (email && email === SUPER_ADMIN_EMAIL) return true;
      // uid ドキュメント優先
      const uidRef = doc(db, 'admin_users', uid);
      const uidSnap = await getDoc(uidRef);
      if (uidSnap.exists()) {
        const data = uidSnap.data() as AdminUser;
        // 互換性のため tier 未設定(null)はスーパー扱い
        return (data.tier ?? 'super') === 'super';
      }
      if (email) {
        const emailRef = doc(db, 'admin_users', email);
        const emailSnap = await getDoc(emailRef);
        if (emailSnap.exists()) {
          const data = emailSnap.data() as AdminUser;
          return (data.tier ?? 'super') === 'super';
        }
        // 過去データ互換: 生成ID
        const legacyId = this.generateUidFromEmail(email);
        const legacyRef = doc(db, 'admin_users', legacyId);
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          const data = legacySnap.data() as AdminUser;
          return (data.tier ?? 'super') === 'super';
        }
      }
      return false;
    } catch (error) {
      console.error('❌ スーパー管理者チェックエラー:', error);
      return false;
    }
  },
  
  // メールアドレスからUIDを推測（簡易版）
  // 実際の実装では、ユーザー検索機能が必要
  generateUidFromEmail(email: string): string {
    return email.replace('@', '_at_').replace(/\./g, '_dot_');
  },

  // メールアドレスから実際のFirebase Auth UIDを取得
  // 注意: この機能はFirebase Admin SDKが必要（クライアント側では制限あり）
  async getUidByEmail(email: string): Promise<string | null> {
    try {
      // クライアント側では Auth からの直接検索不可のため、
      // ログイン時に書き込まれる user_profiles を参照して UID を逆引きする
      const snap = await getDocs(query(collection(db, 'user_profiles'), where('email', '==', email), limit(1)) as any);
      if (!snap.empty) {
        return snap.docs[0].id;
      }
      return null;
    } catch (error) {
      console.error('❌ UID取得エラー:', error);
      return null;
    }
  },

  // ログイン時にユーザープロファイルを保存（UID→emailマップ）
  async upsertUserProfile(uid: string, email: string, displayName?: string | null): Promise<void> {
    try {
      await setDoc(doc(db, 'user_profiles', uid), {
        uid,
        email,
        displayName: displayName || null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (e) {
      console.error('❌ user_profiles upsert 失敗', e);
    }
  },
  
  // 最初の管理者（スーパー管理者）かどうかチェック
  async isFirstAdmin(uid: string): Promise<boolean> {
    try {
      // スーパー管理者メールを優先
      try {
        const me = await getDoc(doc(db, 'admin_users', uid));
        const email: string | undefined = me.exists() ? (me.data() as any).email : undefined;
        if (email === SUPER_ADMIN_EMAIL) return true;
      } catch {}

      const adminUsers = await this.getAdminUsers();
      
      // 管理者が1人しかいない場合、その人が最初の管理者
      if (adminUsers.length === 1) {
        return adminUsers[0].uid === uid;
      }
      
      // 複数の管理者がいる場合、最初に追加された人が最初の管理者
      if (adminUsers.length > 1) {
        const sortedAdmins = adminUsers.sort((a, b) => 
          a.assignedAt.toMillis() - b.assignedAt.toMillis()
        );
        return sortedAdmins[0].uid === uid;
      }
      
      return false;
    } catch (error) {
      console.error('❌ 最初の管理者チェックエラー:', error);
      return false;
    }
  },
  
  // 管理者権限の一括初期化（初回セットアップ用）
  async initializeDefaultAdmin(adminEmail: string, adminUid: string): Promise<void> {
    try {
      console.log('🚀 デフォルト管理者初期化開始:', { adminEmail, adminUid });
      
      // 既存の管理者がいるかチェック
      const existingAdmins = await this.getAdminUsers();
      if (existingAdmins.length > 0) {
        console.log('ℹ️ 既存の管理者が存在するため、初期化をスキップ');
        return;
      }
      
      // デフォルト管理者を追加（tier: super）
      await setDoc(doc(db, 'admin_users', adminUid), {
        uid: adminUid,
        email: adminEmail,
        role: 'admin',
        assignedAt: Timestamp.now(),
        assignedBy: 'system',
        tier: 'super'
      });
      
      console.log('✅ デフォルト管理者初期化完了');
    } catch (error) {
      console.error('❌ デフォルト管理者初期化エラー:', error);
      throw error;
    }
  }
};
