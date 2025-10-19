// Firebase設定ファイル
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

// Firestoreデータベースを初期化
export const db = getFirestore(app);

// 開発環境でのFirestore設定を最適化
if (process.env.NODE_ENV === 'development') {
  // オフライン持続性を有効化（開発時のみ）
  try {
    // このエラーは無視できます - 既に有効化されている場合
  } catch (error) {
    console.log('Firestore offline persistence already enabled');
  }
}

// Firebase Authenticationを初期化
export const auth = getAuth(app);

export default app;
