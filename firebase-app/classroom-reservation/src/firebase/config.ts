// Firebase設定ファイル
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase 設定の取得
function getEnvOrNull(name: string): string | null {
  const v = process.env[name];
  return v ? String(v) : null;
}

function getConfigFromEnv(): Record<string, string> | null {
  const cfg = {
    apiKey: getEnvOrNull('REACT_APP_FIREBASE_API_KEY'),
    authDomain: getEnvOrNull('REACT_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvOrNull('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvOrNull('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvOrNull('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvOrNull('REACT_APP_FIREBASE_APP_ID')
  } as Record<string, string | null> as any;
  const ok = cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.storageBucket && cfg.messagingSenderId && cfg.appId;
  return ok ? (cfg as any) : null;
}

function getConfigFromHostingSync(): Record<string, string> | null {
  try {
    if (typeof window === 'undefined') return null;
    // Firebase Hosting が提供する初期化エンドポイント
    const url = '/__/firebase/init.json';
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // 同期リクエスト（初期化時のみ）
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      const json = JSON.parse(xhr.responseText);
      // 形式: { projectId, appId, apiKey, authDomain, storageBucket, ... }
      if (json && json.apiKey && json.projectId && json.appId) {
        return json;
      }
    }
  } catch {}
  return null;
}

const firebaseConfig = getConfigFromEnv() || getConfigFromHostingSync();
if (!firebaseConfig) {
  throw new Error('Firebase config is missing. Set REACT_APP_FIREBASE_* or host on Firebase Hosting.');
}

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig as any);

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
export const storageBucketName = (firebaseConfig as any).storageBucket;

export default app;
