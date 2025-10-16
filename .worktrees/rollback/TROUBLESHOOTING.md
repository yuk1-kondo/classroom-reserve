# 教室予約システム トラブルシューティングガイド

## よくある問題と解決方法

### 1. 予約が存在するのに「予約なし」と表示される

**症状:**
- カレンダーには予約が表示されている
- 時間割選択で「予約済み」が表示されない
- コンソールログで reservationsCount: 0 となる

**確認手順:**
1. ブラウザのコンソールログを確認
2. 検索範囲の時刻設定をチェック
3. Firestoreのデータを直接確認

**原因と解決:**
```typescript
// ❌ 問題のあるコード
const startOfDay = new Date(date); // 09:00:00になる

// ✅ 正しいコード
const startOfDay = new Date(date);
startOfDay.setHours(0, 0, 0, 0); // 00:00:00に設定
```

**関連ファイル:**
- `src/hooks/useReservationData.ts`
- `src/hooks/useConflictDetection.ts`

### 2. 教室が重複して表示される

**症状:**
- 教室選択ドロップダウンに同じ教室が複数表示される

**確認手順:**
1. Firestoreの rooms コレクションを確認
2. 重複データの存在をチェック

**解決方法:**
```javascript
// クリーンアップスクリプト実行
node cleanup-rooms.js
```

### 3. 認証エラー

**症状:**
- ログインできない
- 「認証情報が無効です」エラー

**確認手順:**
1. Firebase Authentication設定確認
2. セキュリティルール確認
3. APIキー設定確認

**解決方法:**
- Firebase Console で Authentication を有効化
- Firestore Security Rules を確認

### 4. デプロイエラー

**症状:**
- `firebase deploy` が失敗する
- ビルドエラーが発生する

**確認手順:**
1. `npm run build` でローカルビルド確認
2. Firebase設定ファイル確認
3. 権限設定確認

**解決方法:**
```bash
# 依存関係の再インストール
npm install

# クリーンビルド
npm run build

# Firebase再ログイン
firebase login
```

## デバッグに役立つコンソールコマンド

### データ確認
```javascript
// Firestore の予約データ確認
console.log('予約データ:', await reservationsService.getReservations(startDate, endDate));

// 特定教室の予約確認
console.log('教室予約:', await reservationsService.getRoomReservations(roomId, startDate, endDate));
```

### 日付範囲の確認
```javascript
// 検索範囲の確認
const startOfDay = new Date('2025-08-06');
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date('2025-08-06');
endOfDay.setHours(23, 59, 59, 999);
console.log('検索範囲:', { startOfDay, endOfDay });
```

## 緊急時の対処

### 1. 全データバックアップ
```bash
# Firestore データのエクスポート
firebase firestore:export gs://your-bucket/backup-$(date +%Y%m%d)
```

### 2. ロールバック
```bash
# 前のバージョンに戻す
git checkout <previous-commit-hash>
firebase deploy --only hosting
```

### 3. セキュリティルール一時無効化（緊急時のみ）
```javascript
// firestore.rules（開発時のみ）
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // 本番では使用禁止
    }
  }
}
```

## 連絡先とリソース

- **Firebase Console:** https://console.firebase.google.com/project/owa-cbs
- **本番サイト:** https://owa-cbs.web.app
- **GitHub Repository:** https://github.com/yuk1-kondo/classroom-reserve

## チェックリスト（リリース前）

- [ ] ローカルでの動作確認完了
- [ ] テストデータでの予約作成・削除確認  
- [ ] 時間重複チェック機能確認
- [ ] 各教室での予約表示確認
- [ ] セキュリティルールの確認
- [ ] 本番環境でのスモークテスト完了
