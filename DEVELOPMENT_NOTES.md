# 教室予約システム 開発記録

## 重要な修正履歴

### 2026/01/23 - 予約禁止期間設定機能の追加

#### 🎯 要件
管理者が指定した期間の予約を一般ユーザーに対してブロックする機能。
- 例: 春休み期間中は予約不可
- 全教室 or 特定教室を選択可能
- 管理者は例外として禁止期間中も予約可能

#### 🛠️ 実装内容

**1. Firestoreコレクション: `blocked_periods`**
```typescript
{
  startDate: "2026-03-25",  // YYYY-MM-DD
  endDate: "2026-04-07",
  roomId?: "room-1",        // nullなら全教室
  roomName?: "PC室",
  reason?: "春休み",
  createdBy: "uid",
  createdAt: Timestamp
}
```

**2. Firestoreルール**
```javascript
match /blocked_periods/{blockId} {
  allow read: if true;        // 全員読み取り可（バリデーション用）
  allow write: if isAdmin();  // 管理者のみ書き込み
}
```

**3. サービス層: `blockedPeriodsService`**
- `getAll()`: 全禁止期間を取得
- `add()`: 禁止期間を追加
- `remove()`: 禁止期間を削除
- `check()`: 単一日付のブロックチェック
- `checkMultiple()`: 複数日付のブロックチェック（予約フォーム用）

**4. 予約作成時のバリデーション（`SidePanel.tsx`）**
```typescript
// 管理者でない場合のみチェック
if (!isAdmin) {
  const blocked = await blockedPeriodsService.checkMultiple(dates, roomId);
  if (blocked) {
    toast.error(`${blocked.startDate}〜${blocked.endDate} は予約禁止期間です`);
    return;
  }
}
```

#### 🐞 遭遇した問題と解決

**Firestore undefined エラー**
- 問題: `addDoc()` で `undefined` 値を含むオブジェクトを渡すとエラー
- 原因: `roomId: roomId || undefined` のように書くと `undefined` がFirestoreに渡される
- 解決: サービス層で明示的にオブジェクトを構築し、値がある場合のみフィールドを追加

```typescript
const data: Record<string, any> = {
  startDate: block.startDate,
  endDate: block.endDate,
  createdBy: block.createdBy,
  createdAt: Timestamp.now()
};
// オプションフィールドは値がある場合のみ追加
if (block.roomId !== undefined) data.roomId = block.roomId;
```

#### 🧩 変更ファイル
- `firebase-app/firestore.rules`
- `firebase-app/classroom-reservation/src/firebase/blockedPeriods.ts`（新規）
- `firebase-app/classroom-reservation/src/components/admin/BlockedPeriodsSettings.tsx`（新規）
- `firebase-app/classroom-reservation/src/components/SidePanel.tsx`

---

### 2026/01/20 - 会議室パスコード削除の安定化

#### 🐛 問題
会議室の予約をパスコードで削除しようとしても失敗する事例が発生。

#### 🔍 原因分析
1. `deleteReservation` のトランザクション内で `month_overview` を更新しているが、
   Firestore ルールで `month_overview` の書き込みが許可されていなかったため、
   **permission-denied で削除自体が失敗**していた。
2. 会議室判定が `roomName === '会議室'` の完全一致で、
   **表記ゆれ（例: 余分な空白や付加情報）でボタンが表示されない**可能性があった。
3. 未ログインでもパスコード削除UIが出ると、削除は必ず失敗する（ルールは認証必須）。

#### ✅ 解決策
1. **Firestore ルール**で `month_overview` の書き込みを認証済みに許可  
   - 削除フローは既存のまま維持し、失敗を回避  
2. **会議室判定を柔軟化**  
   - `roomName` の空白を除去し、`'会議室'` を含むかで判定  
3. **未ログイン時はパスコード削除UIを非表示**  
   - UIとルールの整合性を確保

#### 🧭 仕組みのメモ
- **パスコード認証はUI側のみ**で実施（PasscodeModal）
- Firestore ルール側には「パスコード判定」は存在しない  
  → 認証済みユーザーであれば `roomName == '会議室'` の削除は許可される
- `month_overview` は現状UI/運用で参照していない

#### 🧩 変更ファイル
- `firebase-app/firestore.rules`
- `firebase-app/classroom-reservation/src/components/ReservationModal.tsx`
- `firebase-app/classroom-reservation/src/components/DailyReservationTable.tsx`

### 2025/08/06 - 予約重複検知機能の修正

#### 🐛 問題
予約が存在するにも関わらず、「予約済み」として表示されない問題が発生していた。

**症状:**
- CalendarComponentでは「📅 予約データ取得成功: 2件」と表示
- useReservationDataでは「🔍 loadReservationsForDate: 取得結果 {count: 0, data: Array(0)}」
- isPeriodReservedで常にfalseが返される

#### 🔍 原因分析
**根本原因:** 日付の時間範囲設定の問題

```typescript
// ❌ 問題のあったコード
const startOfDay = new Date(date);  // デフォルトで09:00:00になる
const endOfDay = new Date(date);
endOfDay.setHours(23, 59, 59, 999);
```

- `new Date(date)`は時刻を09:00:00に設定する
- 0限（07:30-08:30）、1限（08:50-09:40）の一部が検索範囲から除外
- 午前中の予約が見つからない問題が発生

#### ✅ 解決策

```typescript
// ✅ 修正後のコード  
const startOfDay = new Date(date);
startOfDay.setHours(0, 0, 0, 0); // 00:00:00から開始
const endOfDay = new Date(date);
endOfDay.setHours(23, 59, 59, 999);
```

**修正ファイル:**
1. `/src/hooks/useReservationData.ts` - 予約データ取得時の時間範囲修正
2. `/src/hooks/useConflictDetection.ts` - 重複チェック時の時間範囲修正

#### 📚 学んだポイント

**間違えやすいポイント:**
1. **JavaScriptの日付初期化の罠**
   - `new Date(YYYY-MM-DD)`は地域によって時刻が異なる
   - 日本では09:00:00になることがある
   - 必ず`setHours(0,0,0,0)`で明示的に設定する

2. **デバッグ時の注意点**
   - データが「存在しない」のか「取得範囲から外れている」のかを区別
   - 検索条件（WHERE句の範囲）を必ずログ出力する
   - 複数のコンポーネントで同じクエリを実行している場合は条件を統一

3. **時間データの扱い**
   - 学校の時間割は07:30から始まる
   - 検索範囲は00:00:00-23:59:59で1日全体をカバーすること

#### 🔧 予防策
1. 日付操作時は必ず時刻も明示的に設定
2. デバッグログで検索範囲を必ず出力
3. 時間関連のユニットテストを作成

## コード品質向上の記録

### Firestore データ整合性
- 重複データクリーンアップスクリプト作成
- 42室 → 21室に正規化完了

### セキュリティ
- Firebase Security Rulesの適切な設定
- 読み取り専用アクセスの実装

### デバッグ機能
- 詳細なコンソールログ実装
- データフロー追跡機能

## 今後の注意事項

1. **日付操作時の必須チェック**
   ```typescript
   // 必ずこのパターンを使用
   const startOfDay = new Date(date);
   startOfDay.setHours(0, 0, 0, 0);
   ```

2. **クエリ範囲の検証**
   - 検索結果が0件の時は範囲設定を疑う
   - ログで実際の検索範囲を確認

3. **時間割の考慮**
   - 0限は07:30開始
   - 全時限をカバーする検索範囲が必要

## デプロイ環境
- **本番URL:** https://owa-cbs.web.app
- **Firebase Project:** owa-cbs
- **最終デプロイ:** 2025/08/06 23:47

## 修正完了の確認項目
- [x] 予約データ取得の時間範囲修正
- [x] 重複検知機能の時間範囲修正  
- [x] 午前中時限の予約表示確認
- [x] isPeriodReserved関数の正常動作
- [x] 本番環境デプロイ完了
