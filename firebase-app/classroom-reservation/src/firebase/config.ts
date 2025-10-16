// Firebase設定ファイル
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase設定（Firebase Consoleから取得）
const firebaseConfig = {
  apiKey: "AIzaSyCfoxuAOMMfYBA3RfUU99FsZVbYrpyUkh4",
  authDomain: "owa-cbs.firebaseapp.com",
  projectId: "owa-cbs",
  storageBucket: "owa-cbs.firebasestorage.app",
  messagingSenderId: "943019235591",
  appId: "1:943019235591:web:e4fe959a4c135524cc0da2"
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

// Expose storage bucket name for bundle downloads
export const storageBucketName = firebaseConfig.storageBucket;

export default app;
