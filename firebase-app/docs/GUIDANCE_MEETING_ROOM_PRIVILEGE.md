# 進路指導部・会議室の先日付特例

## 概要

- `guidance_group_members/{UID}` に登録されたユーザーは、**`system_settings/guidance_privilege`** で指定した **会議室（roomId）** の予約についてのみ、全体の予約最終日（`system_settings/global.reservationMaxTimestamp`）を超えた日付でも作成できる。
- **禁止期間**（`blocked_periods`）は従う（管理者と同様に先日付だけ免除）。
- Firestore ルールとクライアントの判定は `utils/reservationLimits.ts` の `canBypassSystemReservationDateLimit` と同一論理に揃えている。

## 初回セットアップ

1. **デプロイ**: `firestore.rules` を含めてデプロイする。
2. **管理・設定**（スーパー管理者）→ **進路・会議室特例** を開く。
3. **会議室**をプルダウンで選び「紐付けを保存」する（内部で `system_settings/guidance_privilege` が作成される）。
4. **メンバー追加**に各教員の **Firebase Auth UID** を入力して追加する。

## プレビュー（Hosting チャネル）

- フロントのみプレビューURLで確認可能。
- 本機能は **Firestore のデータとルール**に依存するため、検証時は **本番プロジェクトにルールをデプロイ済み**かつ **上記セットアップ済み**であること。

## 関連ファイル

- ルール: `firebase-app/firestore.rules`
- サービス: `classroom-reservation/src/firebase/guidancePrivilege.ts`
- UI: `classroom-reservation/src/components/admin/GuidancePrivilegeSettings.tsx`
- 予約フォーム分岐: `classroom-reservation/src/components/SidePanel.tsx`
