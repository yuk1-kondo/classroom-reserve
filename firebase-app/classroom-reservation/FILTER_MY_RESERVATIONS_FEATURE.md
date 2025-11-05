# 自分の予約のみ表示機能 (Show Only My Reservations Feature)

## 概要 (Overview)

この機能により、ユーザーは日別台帳ビュー (DailyLedgerView) で自分が作成した予約のみを表示するように絞り込むことができます。

This feature allows users to filter the daily ledger view to show only reservations they have created.

## 機能の場所 (Feature Location)

**画面**: 日別台帳ビュー (DailyLedgerView)
**コンポーネント**: `src/components/DailyLedgerView.tsx`

日付選択とナビゲーションボタンの横に、「自分の予約のみ」というラベルのついたチェックボックスがあります。

The checkbox is located in the toolbar area, next to the date picker and navigation buttons, with the label "自分の予約のみ".

## 使い方 (How to Use)

1. 日別台帳ビューを開く
2. ツールバーの「自分の予約のみ」チェックボックスをクリック
3. チェックを入れると、自分が作成した予約のみが表示される
4. チェックを外すと、すべての予約が表示される

## 技術的な実装 (Technical Implementation)

### コンポーネント構造 (Component Structure)

```
MainApp.tsx
  └─ CalendarComponent.tsx
      └─ DailyLedgerView.tsx  ← フィルター機能実装箇所
```

### 状態管理 (State Management)

#### 1. MainApp.tsx
```typescript
const [filterMine, setFilterMine] = useState<boolean>(false);
```

状態は最上位の MainApp で管理され、props を通じて下位コンポーネントに渡されます。

#### 2. CalendarComponent.tsx (中間層)
```typescript
<DailyLedgerView
  date={ledgerDate}
  filterMine={filterMine}
  onFilterMineChange={onFilterMineChange}
  onDateChange={handleLedgerDateChange}
/>
```

#### 3. DailyLedgerView.tsx (実装層)

**UI部分** (lines 205-212):
```typescript
<label className="ledger-filter-mine">
  自分の予約のみ
  <input
    type="checkbox"
    checked={filterMine}
    onChange={e => onFilterMineChange && onFilterMineChange(e.target.checked)}
  />
</label>
```

**フィルタリングロジック** (lines 102-150):
```typescript
const mapReservationsToCells = (
  reservations: Reservation[],
  rooms: Room[],
  filterMine: boolean
): Map<string, Map<string, LedgerCellReservation[]>> => {
  const cellMap = new Map<string, Map<string, LedgerCellReservation[]>>();
  const currentUser = authService.getCurrentUser();

  const allowReservation = (reservation: Reservation) => {
    if (!filterMine) return true;  // フィルターOFF: すべて表示
    if (!currentUser) return false; // フィルターON、未ログイン: 非表示
    return reservation.createdBy === currentUser.uid; // 作成者で絞り込み
  };

  reservations.forEach(reservation => {
    if (!reservation.roomId || !allowReservation(reservation)) return;
    // ... セルにマッピング
  });

  return cellMap;
};
```

### データフロー (Data Flow)

1. **予約作成時** (`useReservationForm.ts`):
```typescript
const reservation: Omit<Reservation, 'id'> = {
  // ... 他のフィールド
  createdBy: currentUser.uid  // ← 作成者のUIDを記録
};
```

2. **フィルタリング判定** (`DailyLedgerView.tsx`):
```typescript
// チェックボックスがONの場合
if (filterMine && currentUser) {
  // reservation.createdBy === currentUser.uid の予約のみ表示
}
```

3. **表示更新**:
- `filterMine` state が変更されると再レンダリング
- `useMemo` により `cellMap` が再計算
- フィルター条件に合う予約のみが表示される

## 認証との統合 (Authentication Integration)

### 現在のユーザー取得

```typescript
const currentUser = authService.getCurrentUser();
```

`authService.getCurrentUser()` は以下を返します:
- **管理者ログイン時**: localStorage の adminUser
- **Googleログイン時**: Firebase Auth の currentUser
- **未ログイン時**: null

### 予約の作成者情報

各予約オブジェクトには `createdBy` フィールドがあります:

```typescript
export interface Reservation {
  id?: string;
  roomId: string;
  roomName: string;
  title: string;
  reservationName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  period: string;
  periodName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;  // ← 作成者のUID
}
```

## エッジケース処理 (Edge Case Handling)

### 1. 未ログイン状態でフィルターON
```typescript
if (!filterMine) return true;
if (!currentUser) return false; // 予約を表示しない
```

### 2. 旧データ（createdBy未設定）
```typescript
return reservation.createdBy === currentUser.uid;
// createdBy が undefined の場合、undefined === "someUid" → false
// → 旧データはフィルター時に表示されない
```

これは正しい動作です。作成者が不明な予約は「自分の予約」として主張できません。

### 3. 異なるユーザーでログインし直した場合
- `currentUser.uid` が変わる
- 以前のユーザーの予約は表示されなくなる
- 新しいユーザーの予約のみが表示される

## スタイリング (Styling)

CSS クラス: `.ledger-filter-mine`

```css
.ledger-filter-mine {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.9rem;
}

.ledger-filter-mine input[type="checkbox"] {
  font-size: 0.9rem;
}
```

## テスト (Testing)

テストファイル: `src/components/DailyLedgerView.test.tsx`

実装されているテスト:
1. ✅ チェックボックスが表示されること
2. ✅ filterMine が true の時、チェックボックスがチェック状態になること
3. ✅ チェックボックスクリック時に onFilterMineChange が呼ばれること
4. ✅ ラベルテキスト「自分の予約のみ」が表示されること
5. ✅ 日付ナビゲーションボタンが表示されること

テスト実行:
```bash
npm test -- --testPathPattern=DailyLedgerView.test.tsx
```

## パフォーマンス考慮事項 (Performance Considerations)

### useMemo の使用

```typescript
const cellMap = useMemo(
  () => mapReservationsToCells(reservationsForDate, rooms, filterMine),
  [reservationsForDate, rooms, filterMine]
);
```

- `filterMine` が変更された時のみ再計算
- 不要な再計算を防ぐ

## 今後の改善案 (Future Enhancements)

1. **フィルター状態の永続化**: localStorage にフィルター設定を保存
2. **複数フィルター**: 部屋、時限、期間などの追加フィルター
3. **ユーザー選択フィルター**: 管理者が他のユーザーの予約を絞り込めるように
4. **フィルター適用時の視覚的フィードバック**: 何件の予約が表示されているかを表示

## トラブルシューティング (Troubleshooting)

### Q: チェックボックスを入れても予約が表示されない
A: 以下を確認してください:
- ログインしているか確認
- その日に自分が作成した予約があるか確認
- 予約に `createdBy` フィールドが設定されているか確認（開発者ツールで Firestore を確認）

### Q: 旧データが表示されない
A: 仕様です。`createdBy` フィールドが設定されていない旧データは、フィルター適用時に表示されません。必要に応じて、データマイグレーションスクリプトで `createdBy` を設定してください。

## 関連ファイル (Related Files)

- `src/components/DailyLedgerView.tsx` - メイン実装
- `src/components/DailyLedgerView.css` - スタイリング
- `src/components/DailyLedgerView.test.tsx` - テスト
- `src/components/CalendarComponent.tsx` - 親コンポーネント
- `src/components/MainApp.tsx` - 状態管理
- `src/hooks/useReservationForm.ts` - createdBy 設定
- `src/firebase/auth.ts` - 認証サービス
- `src/firebase/firestore.ts` - Reservation 型定義

## バージョン履歴 (Version History)

- **v2.1.3**: 機能が完全実装され、動作確認とテスト追加完了
