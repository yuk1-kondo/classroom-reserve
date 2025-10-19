// Firebase設定ファイル
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase設定（環境変数から注入）
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const firebaseConfig = {
  apiKey: req('REACT_APP_FIREBASE_API_KEY'),
  authDomain: req('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: req('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: req('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: req('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: req('REACT_APP_FIREBASE_APP_ID')
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// Firestoreデータベースを初期化（永続化/Multi-Tab対応）
const dbInstance = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const db = dbInstance;

// 開発環境でのFirestore設定を最適化
// 追加の古い方式は使用しない（initializeFirestoreのlocalCacheに統合）

// Firebase Authenticationを初期化
export const auth = getAuth(app);

// Expose storage bucket name for bundle downloads (updated: 2025-10-19)
export const storageBucketName = firebaseConfig.storageBucket;

export default app;
