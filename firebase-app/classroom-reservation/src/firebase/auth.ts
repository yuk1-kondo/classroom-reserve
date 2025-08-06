// Firebase認証関連のサービス
import { 
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  UserCredential
} from 'firebase/auth';
import { auth } from './config';

// 許可されたドメイン設定
const ALLOWED_DOMAIN = 'e.osakamanabi.jp';
const DOMAIN_ERROR_MESSAGE = `${ALLOWED_DOMAIN}ドメインのアカウントのみご利用いただけます`;

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
      
      // ドメイン制限チェック（一時的に無効化）
      if (!user.email) {
        console.error('❌ メールアドレスが取得できません');
        await signOut(auth);
        throw new Error('メールアドレスが取得できませんでした');
      }
      
      // 一時的にドメイン制限をコメントアウト
      // if (!user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      //   console.error('❌ 許可されていないドメイン:', user.email);
      //   await signOut(auth);
      //   throw new Error(DOMAIN_ERROR_MESSAGE);
      // }
      
      console.log('✅ Googleログイン成功:', user.email);
      return result;
    } catch (error) {
      console.error('❌ Googleログインエラー:', error);
      throw error;
    }
  },

  // 管理者ログイン
  async signInAsAdmin(password: string): Promise<boolean> {
    if (password === this.adminPassword) {
      // 管理者として仮想ユーザーを作成
      const adminUser: AuthUser = {
        uid: 'admin',
        email: 'admin@owa-classroom.local',
        displayName: '管理者',
        name: '管理者',
        role: 'admin',
        isAdmin: true
      };
      localStorage.setItem('adminUser', JSON.stringify(adminUser));
      console.log('✅ 管理者ログイン成功');
      return true;
    }
    console.log('❌ 管理者ログイン失敗');
    return false;
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
        // ドメイン制限チェック（一時的に無効化）
        // if (user.email && !this.isAllowedDomain(user.email)) {
        //   console.error('❌ 許可されていないドメインでログイン:', user.email);
        //   await signOut(auth);
        //   callback(null);
        //   return;
        // }

        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: 'teacher'
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
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: 'teacher'
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
    if (!user || !reservationCreatedBy) return false;
    
    // 管理者は全ての予約を編集可能
    if (this.isAdmin()) return true;
    
    // 作成者本人のみ編集可能
    return user.uid === reservationCreatedBy;
  },

  // 予約削除権限チェック
  canDeleteReservation(reservationCreatedBy?: string): boolean {
    return this.canEditReservation(reservationCreatedBy);
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
