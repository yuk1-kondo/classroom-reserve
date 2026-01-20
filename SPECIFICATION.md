# 仕様書（現状）

最終更新: 2026-01-20

## 概要
- 教室予約システム（Web）
- 対象: 学校内運用、ログインユーザー向け
- 技術: React + TypeScript + Firebase（Firestore/Auth/Hosting）

## 画面/UX
- 初回アクセス時の表示日付は **常に当日**
- 台帳ビュー（DailyLedgerView）を中心に予約状況を表示
- 予約作成はサイドパネルから実行

## 認証/権限
- 認証: Googleログイン
- 権限:
  - 管理者: 予約の編集/削除が可能、設定管理が可能
  - 一般ユーザー: 自分の予約のみ削除可能
- 管理者管理: 管理者権限管理UI（スーパー管理者のみ追加/削除可能）

## 予約の作成
- 予約は教室/日付/時限で作成
- 連続時限はまとめて1件の予約として扱う（periodに複数保持）
- 同一教室・同一時限の重複はトランザクションで防止

## 予約の削除
- 標準削除:
  - 作成者本人 または 管理者が削除可能
- 会議室の削除（パスコード）:
  - ログイン済みユーザーのみ対象
  - パスコード認証は **UI側のみ**（PasscodeModal）
  - Firestoreルール上は **会議室の予約はログイン済みなら削除可能**
- 削除経路は統一（deleteReservation）

## 会議室削除パスコード
- 管理者が設定/変更できる
  - サイドパネル > 管理者機能 > パスコード設定
- パスコード未設定の場合はUIに表示されない
- 未ログイン時はパスコード削除UIを表示しない
- 会議室判定は `roomName` に「会議室」が含まれるかで判定

## データ構造（主要）

### Reservation
- roomId: string
- roomName: string
- title: string
- reservationName: string
- startTime / endTime: Timestamp
- period: string（単一/カンマ区切り）
- periodName: string
- createdBy?: string
- createdAt?: Timestamp
- updatedAt?: Timestamp

### ReservationSlot
- roomId: string
- date: string（YYYY-MM-DD）
- period: string
- reservationId?: string
- type?: string（template-lock 等）

## Firestoreルール（要点）
- reservations:
  - create: 認証済み + createdBy一致 + 先日付制限内（管理者は制限なし）
  - update: 作成者 or 管理者
  - delete: 作成者 or 管理者 or 会議室（roomName == '会議室'）
- reservation_slots:
  - 認証済みのみ書き込み
- month_overview:
  - 認証済みのみ書き込み（削除トランザクションの整合性維持）
- system_settings:
  - 管理者のみ書き込み

## 予約制限
- 管理者は日付制限を無視
- 一般ユーザーは管理者設定の範囲内のみ予約可能

## 既知の補足
- `month_overview` は現状UIで利用していないが、削除トランザクション整合のため更新する
- パスコード削除は「UI側の認証」であり、ルールにはパスコードの概念はない
