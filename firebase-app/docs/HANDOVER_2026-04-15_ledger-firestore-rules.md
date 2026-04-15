# 作業記録（引き継ぎ用）— 2026-04-15 前後：一般ユーザー台帳・予約・Firestore ルール

> **目的**: 別セッションの AI / 開発者が、変更経緯・原因・現状のセキュリティ姿勢を追えるようにする。  
> **本番 Firebase プロジェクト例**: `owa-cbs`  
> **主な変更場所**: `firebase-app/firestore.rules`、 `firebase-app/classroom-reservation/src/**`

---

## 1. 起きていた問題（ユーザー報告）

1. **一般ユーザー**で台帳を開くと **「読み込み中…」のまま** または **教室列が出ない・予約が表示されない**。
2. ブラウザコンソールに **`Missing or insufficient permissions`**（`reservations` のクエリ、`rooms` の取得など）。
3. 予約 **作成** も **`documents:commit` が 403**（`permission-denied`）。

---

## 2. 技術的な根本原因（要点）

### 2.1 Firestore の「ルールはフィルタではない」

`startTime` だけで `reservations` を範囲取得すると、**理科専用教室の予約ドキュメントも結果に含まれ得る**と判断され、**一般ユーザー向けクエリ全体が拒否**されることがある（一覧クエリと per-doc ルールの整合）。

### 2.2 `rooms` コレクション全件取得

`scienceGroupOnly` が混在する `rooms` に対し **フィルタなし `getDocs`** すると、同上の理由で **一般ユーザーの一覧取得が拒否**され、**教室一覧が空** → 台帳に列が出ない。

### 2.3 教室マッピングのバグ（重要）

`getAllRooms()` で次の順序だと、**ドキュメント内の `id` フィールドが `docSnap.id` を上書き**する：

```ts
// 悪い例
{ id: docSnap.id, ...docSnap.data() }
```

予約の `roomId` は **正しいドキュメント ID** だが、一覧側の `room.id` がずれ、**`roomId in (...)` 方式のクエリが 0 件**になる原因になった。

**修正**: `{ ...docSnap.data(), id: docSnap.id }` に統一（予約マッピングも同様に `id` を最後に固定）。

### 2.4 `reservation_slots` のトランザクション `get`

**未作成**のスロットを `get` すると、旧ルールが `resource.data.roomId` を評価できず **読み取り拒否**になり得る。

### 2.5 予約 `create` ルールの複合条件

次のいずれかで **Commit 全体が失敗**し得た：

- **`system_settings/global.reservationMaxTimestamp`** による先日付制限（ルール上の比較）。
- **`roomIsScienceGroupOnly(roomId)`** が true（データ上グローバル教室などが誤って理科扱い、または判定が厳しすぎる）。

---

## 3. 実施した対応の整理

### 3.1 フロント（React）

| 内容 | ファイル例 |
|------|------------|
| 台帳のローディング（教室 0 件でもスケルトンを外す） | `DailyLedgerView.tsx`（`roomsLoaded` 等） |
| 教室 ID の正規化 | `firebase/firestore.ts` の `getAllRooms`、予約の `map` |
| `MonthlyReservationsContext` | 途中で **roomId 分割クエリ**を試したが、最終的に **ルール緩和＋単一クエリ**に戻す形に整理 |
| ユーティリティ | `utils/roomAccess.ts`（`filterScienceOnlyRoomsForViewer` 等） |

### 3.2 Firestore ルール（現状の方針）

**方針**: 校内利用を前提に、**一覧・作成で詰まりやすい条件を緩め**、**理科・進路の「見え方」は主にクライアント**で担保。必要なら後から Cloud Functions やフィールド設計で再強化可能。

| コレクション | おおまかな現状（要確認は `firestore.rules` 実体） |
|--------------|--------------------------------------------------|
| `rooms` | 認証済み **read**（一覧クエリが通るように） |
| `reservations` | 認証済み **read**；**create** は `createdBy == request.auth.uid`（作成時は room 理科判定をルールで厳密にしない運用に変更） |
| `reservation_slots` | 認証済み **read / create / update / delete**（トランザクションと未作成 doc の get に対応） |
| 先日付 | ルール上の **日付比較は削除**（運用は管理画面 `system_settings` と UI） |

> **注意**: このリポジトリの `firestore.rules` が真実。デプロイ忘れがあると本番だけ古いルールのまま、という齟齬が出る。

### 3.3 デプロイで使ったコマンド例

```bash
cd firebase-app/classroom-reservation && npm run build
cd firebase-app && firebase deploy --only hosting
cd firebase-app && firebase deploy --only firestore:rules
# まとめて
firebase deploy --only firestore:rules,hosting
```

---

## 4. 運用上のトレードオフ（引き継ぎ先へ）

- **Firestore を直接叩く**と、ルールで緩めた範囲は **アプリ外からもアクセス可能**になり得る（校内・Google アカウント前提の割り切り）。
- **理科専用教室の秘匿**は、厳密には **クライアントフィルタ＋運用**寄り。厳密にサーバーだけで縛るなら、非正規化フィールドや Functions の再検討が必要。
- **`useAuth` が Context ではなく各コンポーネントで `useState` する**既存パターンは、**権限判定のタイミング**で一瞬ズレる可能性がある（別件だが知っておくとよい）。

---

## 5. 確認チェックリスト（リリース前）

- [ ] `firebase deploy --only firestore:rules` が最新 `firestore.rules` を反映しているか
- [ ] `firebase deploy --only hosting` で `classroom-reservation/build` が更新されているか
- [ ] 一般ユーザー：台帳表示・予約作成・自分の予約削除
- [ ] 管理者：従来の管理画面・予約制限設定（表示上の最終日）

---

## 6. 関連コミットを探すとき

ブランチ: 作業時点では `feature/guidance-meeting-room-privilege` 上でした。  
メッセージ例: 「台帳・予約・Firestore ルール整理」などで `git log --oneline -20` を参照。

---

*このファイルは 2026-04-15 前後の障害対応・ルール変更の記録用です。*
