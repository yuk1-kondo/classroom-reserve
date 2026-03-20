// Firebase認証関連のサービス
import { 
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  UserCredential,
  signInAnonymously // 追加: 匿名認証
} from 'firebase/auth';
import { auth } from './config';
import { adminService } from './admin';
import { userAccessService } from './userAccess';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

// 許可されたドメイン設定
const ALLOWED_DOMAIN = 'e.osakamanabi.jp';
const DOMAIN_ERROR_MESSAGE = `${ALLOWED_DOMAIN}ドメインのアカウントのみご利用いただけます`;
// 管理者メール一覧（必要に応じて拡張）
const ADMIN_EMAILS = ['212-schooladmin@e.osakamanabi.jp'];

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'teacher' | 'admin';
  name?: string;
  isAdmin?: boolean;
}

// 認証関連の操作
export const authService = {
  adminPassword: 'admin2025', // 管理者パスワード
  // ログイン有効期間 (ミリ秒)
  LOGIN_TTL_MS: 1000 * 60 * 60 * 24 * 1, // 1日間に短縮（セキュリティ強化）
  LAST_LOGIN_KEY: 'lastLoginAt',

  // Googleサインイン
  async signInWithGoogle(): Promise<UserCredential> {
    try {
      // セッションごとにのみ永続化（タブを閉じるとサインアウト）
      try { await setPersistence(auth, browserLocalPersistence); } catch {}
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      // 毎回アカウント選択を表示
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (!user.email) {
        console.error('❌ メールアドレスが取得できません');
        await signOut(auth);
        throw new Error('メールアドレスが取得できませんでした');
      }
      
      // ドメイン制限を有効化
      if (!user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        console.error('❌ 許可されていないドメイン:', user.email);
        await signOut(auth);
        throw new Error(DOMAIN_ERROR_MESSAGE);
      }
      
      console.log('✅ Googleログイン成功:', user.email);
      // UID とメールの紐付けを user_profiles に保存（管理者追加のための逆引きに使用）
      try { await adminService.upsertUserProfile(user.uid, user.email, user.displayName); } catch {}

      // user_access に upsert → blocked ならサインアウト
      try {
        const status = await userAccessService.upsertOnLogin(user.uid, user.email, user.displayName);
        if (status === 'blocked') {
          console.error('❌ アクセスがブロックされています:', user.email);
          await signOut(auth);
          throw new Error('このアカウントはブロックされています。管理者にお問い合わせください。');
        }
      } catch (e: any) {
        if (e?.message?.includes('ブロック')) throw e;
      }

      try { localStorage.setItem(this.LAST_LOGIN_KEY, String(Date.now())); } catch {}
      return result;
    } catch (error) {
      console.error('❌ Googleログインエラー:', error);
      throw error;
    }
  },

  // 管理者ログイン
  async signInAsAdmin(password: string): Promise<boolean> {
    if (password !== this.adminPassword) {
      console.log('❌ 管理者ログイン失敗');
      return false;
    }
    try {
      // 既に Firebase 認証済みでなければ匿名認証で request.auth を確保
      if (!auth.currentUser) {
        await signInAnonymously(auth);
        console.log('ℹ️ 匿名認証で Firebase に接続 (管理者モード)');
      }
      const base = auth.currentUser; // 匿名 or 既存ユーザー
      if (!base) {
        console.error('❌ Firebaseユーザー生成に失敗');
        return false;
      }
      const adminUser: AuthUser = {
        uid: base.uid, // Firebase の uid を使用
        email: base.email || 'admin@local',
        displayName: base.displayName || '管理者',
        name: base.displayName || '管理者',
        role: 'admin',
        isAdmin: true
      };
      localStorage.setItem('adminUser', JSON.stringify(adminUser));
      try { localStorage.setItem(this.LAST_LOGIN_KEY, String(Date.now())); } catch {}
      console.log('✅ 管理者ログイン成功 uid=', adminUser.uid);
      return true;
    } catch (e) {
      console.error('❌ 管理者ログイン処理エラー', e);
      return false;
    }
  },

  // サインアウト
  async signOut(): Promise<void> {
    try {
      localStorage.removeItem('adminUser');
      localStorage.removeItem('lastLoginAt');
      await signOut(auth);
      console.log('👋 ログアウト完了');
    } catch (error) {
      console.error('サインアウトエラー:', error);
      throw error;
    }
  },

  // 認証状態の変更を監視
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    // 管理者ログインの場合は即座にコールバック実行
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      // TTLチェック
      try {
        const last = Number(localStorage.getItem(this.LAST_LOGIN_KEY) || '0');
        if (last > 0 && Date.now() - last > this.LOGIN_TTL_MS) {
          this.signOut();
          callback(null);
          return () => {};
        }
      } catch {}
      setTimeout(() => callback(JSON.parse(adminUser)), 0);
      return () => {}; // 空のunsubscribe関数
    }

    return onAuthStateChanged(auth, async (user: User | null) => {
      // TTLチェック（一般ログイン）
      try {
        const last = Number(localStorage.getItem(this.LAST_LOGIN_KEY) || '0');
        if (last > 0 && Date.now() - last > this.LOGIN_TTL_MS) {
          await signOut(auth);
          localStorage.removeItem(this.LAST_LOGIN_KEY);
          callback(null);
          return;
        }
      } catch {}
      if (user) {
        if (user.email && !this.isAllowedDomain(user.email)) {
          console.error('❌ 許可されていないドメインでログイン:', user.email);
          await signOut(auth);
          callback(null);
          return;
        }

        // blocked チェック（セッション復元時にも効かせる）
        try {
          const status = await userAccessService.getUserStatus(user.uid);
          if (status === 'blocked') {
            console.error('❌ ブロックされたユーザー:', user.email);
            await signOut(auth);
            callback(null);
            return;
          }
        } catch {}

        const isAdmin = !!(user.email && ADMIN_EMAILS.includes(user.email));
        try { if (!localStorage.getItem(this.LAST_LOGIN_KEY)) localStorage.setItem(this.LAST_LOGIN_KEY, String(Date.now())); } catch {}
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: isAdmin ? 'admin' : 'teacher',
          isAdmin
        });
      } else {
        callback(null);
      }
    });
  },

  // 現在のユーザーを取得
  getCurrentUser(): AuthUser | null {
    // 管理者ログインをチェック
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      return JSON.parse(adminUser) as AuthUser;
    }

    // Firebaseユーザーをチェック
    const user = auth.currentUser;
    if (user) {
      // ドメイン制限（念のため二重チェック）
      if (user.email && !this.isAllowedDomain(user.email)) {
        return null;
      }
      const isAdmin = !!(user.email && ADMIN_EMAILS.includes(user.email));
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: isAdmin ? 'admin' : 'teacher',
        isAdmin
      };
    }
    return null;
  },

  // 現在のユーザー（簡易認証含む）
  getCurrentUserExtended(): AuthUser | null {
    return this.getCurrentUser();
  },

  // 簡易ログアウト（互換性のため）
  simpleLogout(): void {
    this.signOut();
  },

  // 管理者権限チェック
  isAdmin(): boolean {
  const user = this.getCurrentUser();
  // メールでの管理者指定を優先
  if (user?.email && ADMIN_EMAILS.includes(user.email)) return true;
  return user?.role === 'admin' || user?.isAdmin === true;
  },

  // Firestore ルール適合用: メールベースの管理者かどうか
  isEmailAdmin(): boolean {
    const user = this.getCurrentUser();
    return !!(user?.email && ADMIN_EMAILS.includes(user.email));
  },

  // 教師権限チェック
  isTeacher(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'teacher' || this.isAdmin();
  },

  // 予約の編集・削除権限チェック
  canEditReservation(reservationCreatedBy?: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (this.isAdmin()) return true; // 管理者無条件
    if (!reservationCreatedBy) return false;
    return user.uid === reservationCreatedBy;
  },

  // 予約削除権限チェック
  canDeleteReservation(reservationCreatedBy?: string): boolean {
    if (this.isAdmin()) return true; // 最優先
    const user = this.getCurrentUser();
    if (!user) return false;
    if (!reservationCreatedBy) return false;
    return user.uid === reservationCreatedBy;
  },

  // ドメイン制限チェック（ユーティリティ）
  isAllowedDomain(email: string): boolean {
    return email.endsWith(`@${ALLOWED_DOMAIN}`);
  },

  // 許可ドメインの取得
  getAllowedDomain(): string {
    return ALLOWED_DOMAIN;
  },

  // ドメイン制限のエラーメッセージ
  getDomainErrorMessage(): string {
    return DOMAIN_ERROR_MESSAGE;
  }
};
