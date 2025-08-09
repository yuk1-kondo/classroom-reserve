# 🌸 桜和高校教室予約システム (Owa-CBS)

React + TypeScript + Firebase による現代的な教室予約管理システム

## 🌐 ライブサイト
**https://owa-cbs.web.app**

## 📅 バージョン
現在バージョン: **2.0.1 (2025-08-09)**

## ✨ 主な機能
- 📅 FullCalendar.js によるインタラクティブなカレンダー表示 (日 / 週 / 月 切替)
- 🔐 Google Authentication (教師・管理者ロール判定 / 削除権限制御)
- 🏫 教室管理 (Firestore rooms コレクション)
- 🗓 時限ベース予約 (0限〜7限 + 昼休み + 放課後) / 連続時限統合表示 (例: 1,2,3 → 1限〜3限)
- ⏱ PERIOD_ORDER / periodTimeMap による時限定義一元化（昼休みを4限と5限の間に表示）
- ❗ 予約重複検知 (useConflictDetection / デバウンス + 日付範囲補正バグ修正済)
- 🧭 日付境界安全処理 (必ず 00:00:00〜23:59:59 範囲で Firestore クエリ)
- ✏️ 予約詳細モーダル (PC/モバイル統一 2カラム + 全幅タイトル + インライン削除確認)
- 🗑 インライン削除確認 UI (1クリックで確認表示 → 「確定 / キャンセル」) フォーカス管理対応
- 📥 CSV インポート / 📤 エクスポート（予約データ運用補助）
- 📱 完全レスポンシブ / PWA 対応 (manifest / アイコン / スプラッシュ)
- 🎨 桜和高校カスタムブランディング (配色 / ロゴ / favicon / 角丸 / モーション)
- ⚡ Firestore リアルタイム同期 & 楽観的 UI 更新
- 🔎 ログ & デバッグ (主要フックに限定ログ / 過剰出力抑制)

## 🛠️ 技術スタック
- **フロントエンド**: React 18 + TypeScript (CRA)
- **状態/ロジック**: カスタムフック (useReservationData / useConflictDetection / useAuth / useReservationForm)
- **バックエンド**: Firebase (Firestore / Auth / Hosting)
- **データモデル**: Reservation / Room (型安全な Firestore アクセス層)
- **UI**: FullCalendar v6 + カスタムCSS (MUI 依存最小化)
- **ビルド**: react-scripts (最適化 / gzip / キャッシュバスティング)
- **デプロイ**: Firebase CLI (単一 SPA rewrite)

## 🧱 アーキテクチャ概要
```
src/
  components/      プレゼンテーション + 一部コンテナ (Calendar, ReservationModal, SidePanel...)
  firebase/        Firestore / Auth サービス層 (副作用一元化)
  hooks/           UI から独立したビジネスロジック (データ取得 / 重複検知 / 認証状態)
  index.tsx        ルートマウント
  App.tsx          画面構成 (レイアウト/ルーティング相当)
```

### Firestore サービス (firebase/firestore.ts)
- `roomsService`: 教室 CRUD (現在は取得 + 追加)
- `reservationsService`: 期間 / 教室 / 日 別取得 + 追加 / 更新 / 削除 + 月単位/全削除
- `periodTimeMap`: 時限→開始/終了時刻/表示名
- `PERIOD_ORDER`: 時限表示順の唯一のソース (UI 並び / 並べ替え統一)
- `createDateTimeFromPeriod`: 日付文字列 + 時限 → 開始/終了 Date 生成

### 重複検知 (hooks/useConflictDetection.ts)
- 入力フォーム変更を 300ms デバウンスし Firestore 既存予約と時刻重なりを判定
- 日の範囲は 00:00:00〜23:59:59 に正規化 (過去バグ修正ポイント)
- 結果: 予約フォームに警告表示 + ボタン制御

### 予約データ取得 (hooks/useReservationData.ts)
- 選択日 / 期間を監視し Firestore クエリ
- モバイル/PC 双方で必要な最小フィールドを返却
- 取得件数ログで異常検知容易化

### 予約詳細モーダル (components/ReservationModal.tsx)
- PC/モバイル共通 2カラムグリッド (日付/時限・教室/予約者・タイトル全幅)
- インライン削除 (role="alertdialog" + 初期フォーカス)
- 期間表示は `period` の形式 (カンマ/ハイフン) を統一整形

### 削除 UX
- 旧: 二重ボタン & レイアウト崩れ
- 新: 1ステップ → confirm inline →確定/キャンセル。視線移動/タップ数削減。

### 日付境界バグ修正
- `new Date('YYYY-MM-DD')` が 09:00 になる環境差により午前予約除外 → `setHours(0,0,0,0)` を全取得処理へ適用

## 🧪 品質対策
- Firestore クエリ境界統一 (00:00:00 / 23:59:59)
- 時限定義集中管理 (メンテナンス 1 箇所)
- デバウンスによる無駄な読込削減
- インライン確認で誤操作抑制
- モーダル focus 管理 (アクセシビリティ)

## 🚀 デプロイ情報
- **ホスティング**: Firebase Hosting (SPA rewrite → /index.html)
- **プロジェクトID**: owa-cbs
- **ブランチ**: main
- **最終デプロイ**: 2025-08-09

## 🗂 データモデル
| フィールド | 型 | 説明 |
|------------|----|------|
| roomId | string | 教室ID (rooms参照) |
| roomName | string | 教室名キャッシュ |
| title | string | 予約名 |
| reservationName | string | 予約者表示名 |
| period | string | 時限 (単一 / カンマ / ハイフン表現) |
| periodName | string | 表示用時限名 (map由来) |
| startTime / endTime | Timestamp | 予約時間境界 |
| createdBy | string | UID |
| createdAt | Timestamp | 作成時刻 |

## 🔐 権限モデル
- 削除ボタン表示条件: `authService.canDeleteReservation(createdBy)` → 管理者 または 自身作成

## 🏁 開発上の主要改善履歴 (抜粋)
- 予約重複検知: 時間境界バグ修正 + デバウンス適用
- 時限表示: 昼休み挿入 / PERIOD_ORDER で統一
- 予約詳細モーダル: レイアウト刷新 / モバイル共通化 / インライン削除
- ログインUI: 文言・配色統一 (primary-red ボタン)
- 削除UX: 二重確認排除 → コンパクト化
- スタイル: 共通余白/角丸/影最適化

## 📝 今後の拡張候補
- 繰り返し(定期)予約
- 通知 (メール / Push)
- 承認フロー
- 統計ダッシュボード
- 単体テスト (Jest) 境界時刻ケース

## 🔄 セットアップ / デプロイ手順 (再掲)
```
# 依存インストール
npm install

# 開発
npm start

# 本番ビルド + デプロイ
npm run build
firebase deploy --only hosting
```

## 📄 ライセンス
© 2025 桜和高校教室予約システム (Owa-CBS) - Developed by YUKI KONDO