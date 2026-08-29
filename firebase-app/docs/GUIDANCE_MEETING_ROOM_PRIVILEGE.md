# 進路指導部・会議室の先日付特例

## 概要

- `guidance_group_members/{UID}` に登録されたユーザーは、**`system_settings/guidance_privilege`** で指定した **会議室（roomId）** の予約についてのみ、全体の予約最終日（`system_settings/global.reservationMaxTimestamp`）を超えた日付でも作成できる。
- **禁止期間**（`blocked_periods`）は従う（管理者と同様に先日付だけ免除）。
- Firestore ルールとクライアントの判定は `utils/reservationLimits.ts` の `canBypassSystemReservationDateLimit` と同一論理に揃えている。

## 初回セットアップ

1. **デプロイ**: `firestore.rules` を含めてデプロイする。
2. **管理・設定**（スーパー管理者）→ **進路・会議室特例** を開く。
3. **会議室**をプルダウンで選び「紐付けを保存」する（内部で `system_settings/guidance_privilege` が作成される）。
4. **メンバー追加**は、**ログイン済みユーザー一覧**から検索して「進路に追加」する（推奨）。一覧に出ない場合のみ **Firebase UID を手入力**する。

### メンバー追加（案B：ログイン済みユーザー一覧）

- データソースは **`user_access`**（ユーザー管理と同じ）。年度初めに教職員へログインしてもらう運用と相性がよい。
- ピッカーは **「許可」状態**のユーザーのみ表示し、検索で絞り込める（表示件数に上限あり）。
- まだ一度もログインしておらず `user_access` に載らない UID のみ、手入力で追加する。

## ユーザー管理で「削除」した先生が再び一覧に出る場合

- **原因**: `user_profiles` はログインのたびに残る一方、管理画面では `user_profiles` → `user_access` の**同期**が走るため、単に `user_access` だけ削除すると再取り込みされる。また、**同じ Google アカウントで再ログイン**すると `user_access` が再作成される。
- **対策**: 管理者がユーザー一覧からユーザーを削除したとき、**`user_access_exclusions/{uid}`** に記録する。同期は除外 UID をスキップし、ログイン時は **ブロック扱い**（アプリはサインアウト）となる。
- **誤って除外した場合**: 管理者が **`user_access_exclusions` の該当ドキュメントを削除**するか、アプリから `userAccessService.clearAccessExclusion(uid)` に相当する運用（将来 UI 化可）で解除すると、次回の同期またはログインで再登録できる。

## プレビュー（Hosting チャネル）

- フロントのみプレビューURLで確認可能。
- 本機能は **Firestore のデータとルール**に依存するため、検証時は **本番プロジェクトにルールをデプロイ済み**かつ **上記セットアップ済み**であること。

## 関連ファイル

- ルール: `firebase-app/firestore.rules`
- サービス: `classroom-reservation/src/firebase/guidancePrivilege.ts`
- `user_access` / 除外: `classroom-reservation/src/firebase/userAccess.ts`
- UI: `classroom-reservation/src/components/admin/GuidancePrivilegeSettings.tsx`
- ユーザー管理（削除時に除外作成）: `classroom-reservation/src/components/admin/UserAccessManager.tsx`
- 予約フォーム分岐: `classroom-reservation/src/components/SidePanel.tsx`
