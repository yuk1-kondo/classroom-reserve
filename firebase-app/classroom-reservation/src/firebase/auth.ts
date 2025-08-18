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

  // Googleサインイン
  async signInWithGoogle(): Promise<UserCredential> {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
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
      setTimeout(() => callback(JSON.parse(adminUser)), 0);
      return () => {}; // 空のunsubscribe関数
    }

    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (user.email && !this.isAllowedDomain(user.email)) {
          console.error('❌ 許可されていないドメインでログイン:', user.email);
          await signOut(auth);
          callback(null);
          return;
        }

        const isAdmin = !!(user.email && ADMIN_EMAILS.includes(user.email));
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
