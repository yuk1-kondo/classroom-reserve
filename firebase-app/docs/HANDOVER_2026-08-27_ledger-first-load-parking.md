# 作業記録（引き継ぎ用）— 2026-08-27：駐車場テスト追加後の教室台帳初回表示

> **目的**: 別セッションの AI / 開発者が、原因・実運用向け改修・残課題を追えるようにする。  
> **本番 Firebase プロジェクト例**: `owa-cbs`  
> **アプリ表示バージョン**: `2.18.1`（`src/version.ts`）  
> **関連**: 台帳スケルトンの経緯は `HANDOVER_2026-04-15_ledger-firestore-rules.md` も参照

---

## 1. 起きていた問題（ユーザー報告）

駐車場のテスト機能を入れてから、**本運用の教室予約**で「最初に台帳データが出ない」ケースが増えた。

- 教室列は出るが、予約セルが全部 `—` に見える（後から埋まる／空のまま残る、の両方）
- 駐車場コレクションと教室 `reservations` の衝突ではなかった

2026-08-27 の改修後、ローカル確認で **台帳は表示されるようになった**。初回は若干遅いが実用の範囲。駐車場予約の読み込み最適化は **利用頻度が低いため今後検討**。

### 追記（同日・本番障害の確定原因）

実運用（**v2.17.5**）では **教室列だけ消える**（時限のみ）現象が継続。原因は駐車場データではなく、**Firestore ルールで `rooms` / `reservations` が認証必須**になっていたこと。駐車場ルール追加時の **rules 全体デプロイ**で教室側も一緒に厳格化された可能性が高い。

**本番対応（実施済み）**: `rooms` / `reservations` の `read` を `if true` に戻し、`firestore:rules` のみデプロイ。駐車場ルール・データは維持。詳細・週末作業は `HANDOVER_2026-08-27_weekend-parking-work.md`。

---

## 2. 技術的な根本原因（要点）

駐車場は `parking_spots` / `parking_reservations` / `parking_slots` / `parking_group_members` で、教室台帳とは **コレクション・Provider を共有していない**。ルール上も教室 `reservations` の読取条件は変えていない。

悪化の主因は、既存の教室台帳ロード設計に、駐車場テスト追加で増えた起動時処理が重なったこと。

### 2.1 スケルトンが予約取得を待たない（最有力）

`DailyLedgerView` は **教室一覧（`roomsLoaded`）だけで** 「読み込み中」を外していた。`reservationsLoading` は日付ナビの disable にしか使っていなかった。

教室が先に揃うと 120ms 後に表が出る → 予約がまだだとセルは全部 `—`。後から埋まれば「最初だけ空」、失敗して再取得しなければ「空のまま」。

理科台帳対応（列 0 件でもスケルトン解除）の副作用。`HANDOVER_2026-04-15` にも記載あり。

### 2.2 同じ日付範囲は再取得しない

`MonthlyReservationsContext.setRange` は **start/end が同じなら即 return**。失敗時は `[]` にして終わり。

台帳側の `setRange` 呼び出しは `authReady` と日付だけに依存。ログイン完了や `currentUser` 変化では走らない。

流れの例:

1. `authReady` は立ったが、トークン／権限がまだ追いついていない
2. `getReservations` が permission などで失敗 → 空配列
3. その後ログインしても日付が同じなので `setRange` が動かない
4. 教室列だけある、予約だけ空の台帳が残る

成功した空結果は **30秒メモリキャッシュ**（`reservationsService.getReservations`）される。`reservation:changed` も同じ日付なら `setRange` がスキップされ、再取得にならなかった。

### 2.3 駐車場テスト追加が増幅した点

`MainApp` に `useParkingAccess` を常時呼ぶようにした。フック内部で **別の `useAuth()`** を作っていた。

`useAuth` は Context ではなく、呼ぶたびに `onAuthStateChanged` が付き、そのたびに `roomsService.clearRoomsCache()` する。教室トップでは `MainApp`・`useParkingAccess`・`DailyLedgerView` で **認証リスナーが 3 本**（追加前は 2 本）。

加えて、未ログイン中も含め `system_settings/parking` と `parking_group_members/{uid}` を教室台帳と同時に読んでいた。Firestore は `persistentLocalCache` + マルチタブのため、起動直後の読取増は予約クエリの遅れ・失敗を起こしやすくする。

`/parking` と `/` の往復で `MainApp` ごと作り直されるので、同じ空窓がテスト中に再発しやすい。

### 2.4 否定したもの

- コレクション名の衝突
- 教室 `reservations` ルールの破損
- `ParkingReservationsProvider` が教室台帳を包んでいる（`ParkingApp` のみ）

---

## 3. 実施した対応（実運用向け・最小）

`useAuth` の全面 Context 化と Firestore ルール変更は **していない**（影響が大きいため）。

| 内容 | ファイル |
|------|----------|
| 初回は教室 **かつ** 予約取得完了までスケルトン。一度出してからの refetch では点滅させない | `DailyLedgerView.tsx` / `ParkingLedgerView.tsx` |
| Context の `loading` 初期値を `true` | `MonthlyReservationsContext.tsx` / `ParkingReservationsContext.tsx` |
| 取得失敗時 400ms 後に 1 回リトライ。`refetch` はキャッシュ Bypass（教室は `fromServer`） | 同上 |
| ログイン後（uid 変化）は `refetch`。変更イベントも `setRange` ではなく `refetch` | `DailyLedgerView.tsx` / `ParkingLedgerView.tsx` |
| `useParkingAccess` は親の `isAdmin` / `authReady` を受け取る。内部で `useAuth` しない。uid なしでは駐車場 Firestore を読まない | `useParkingAccess.ts` / `MainApp.tsx` / `ParkingApp.tsx` |
| 駐車場台帳は親の `authReady` を props で渡す（子で別 `useAuth` しない） | `ParkingLedgerView.tsx` |

予約の保存・削除の仕様、教室の表示権限、駐車場のアクセス制御ルールは変更していない。

---

## 4. 確認結果（2026-08-27）

- 教室台帳は **表示されるようになった**
- 初回は **若干遅い**が、実用の範囲
- 駐車場予約は利用頻度が低いため、**読み込み最適化は今後検討**

---

## 5. 残課題・今後の検討

0. **ルールと UI の同時リリース**  
   教室を認証必須にする場合は、未ログイン時に Firestore を叩かない UI とセットで。rules だけ先に厳しくしない（2026-08-27 本番障害の教訓）。
1. **駐車場の読み込み遅延**  
   リンク表示のため教室トップで `useParkingAccess` がまだ走る。利用が少ないので急がない。候補: リンクを遅延取得、管理者判定後だけ読む、`useAuth` の Context 化でリスナー一本化。
2. **`useAuth` が Context ではない**  
   コンポーネントごとに `onAuthStateChanged` + `clearRoomsCache`。権限判定のタイミングずれは 2026-04 時点でも既知。今回は駐車場フック側だけ二重化を解消。
3. **30秒レンジキャッシュ**  
   成功した空結果もキャッシュする。今回の `refetch` は bypass するが、初回 `setRange` はキャッシュを使う。
4. **初回の体感速度**  
   スケルトンを予約完了まで残すため、空セルより「読み込み中」が長く見える。意図したトレードオフ。

---

## 6. 確認チェックリスト（リリース前）

- [ ] 教室予約トップ：読み込み中のあと、当日予約が載った台帳が出る
- [ ] 日付移動しても空のまま固まらない
- [ ] 未ログインで開いてからログインすると台帳が埋まる
- [ ] 駐車場リンクは、これまで見えていた人にだけ出る
- [ ] 駐車場台帳（メンバー）も同様に空のまま固まらない

---

## 7. 関連パス

| 内容 | パス |
|------|------|
| 教室台帳 | `classroom-reservation/src/components/DailyLedgerView.tsx` |
| 教室予約 Context | `classroom-reservation/src/contexts/MonthlyReservationsContext.tsx` |
| 教室トップ | `classroom-reservation/src/components/MainApp.tsx` |
| 駐車場権限 | `classroom-reservation/src/hooks/useParkingAccess.ts` |
| 駐車場画面 | `classroom-reservation/src/components/parking/ParkingApp.tsx` |
| 駐車場台帳 | `classroom-reservation/src/components/parking/ParkingLedgerView.tsx` |
| 駐車場予約 Context | `classroom-reservation/src/contexts/ParkingReservationsContext.tsx` |
| 予約取得キャッシュ | `classroom-reservation/src/firebase/firestore.ts`（`getReservations`） |
| 認証（キャッシュ破棄） | `classroom-reservation/src/hooks/useAuth.ts` |

---

*このファイルは 2026-08-27 の教室台帳初回表示対応の記録用です。*
