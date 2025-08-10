# CHANGELOG

## [2.0.2] - 2025-08-10
### 🎨 UI / 表示
- Favicon / PWA アイコン更新: manifest.json を `logo192.png`, `logo512.png`, `favicon.svg` に統一し cache-bust 付き参照へ修正
- 旧 `owa.png` / 不要バックアップアイコンの参照除去
- 日別予約テーブル(DailyReservationTable) 横スクロール除去: `table-layout:fixed` + 列パーセンテージ化 / min-width 撤廃

### ⚙️ 機能 / 挙動
- 競合リセット方式: Option B (日付 / 教室変更時のみリセット) に確定
- 時限ラベルユーティリティ `periodLabel.ts` を src/utils に新規配置（multi-period 正規化継続）

### 🧹 クリーンアップ
- manifest / index.html 内の不要 favicon リンク整理
- 不要 backup アイコンファイル削除

### 🚀 デプロイ
- Firebase Hosting へ反映 (favicon & テーブル修正)

---

## [2.0.1] - 2025-08-09
### 🛠 改善 / UI 仕上げ
- 予約詳細モーダル: PC/モバイル統一 2カラムレイアウト確立
- 日付表示の折返し防止 (モバイル)
- インライン削除確認: グリッドでテキスト左 / ボタン右を固定
- PERIOD_ORDER + periodTimeMap を導入し昼休み表示位置を4限と5限の間に統一
- 予約削除 UX: 二重ボタン排除・1ステップ確認化
- 重複検知: 日付境界(00:00開始)バグ修正による午前予約欠落解消
- ログイン UI 文言・配色整理 (primary-red ボタン / ラベル統一)

### 🔧 内部
- Firestore 日付範囲クエリ統一 (startOfDay.setHours(0,0,0,0))
- デバウンス付き useConflictDetection 再実装
- 不要な冗長ログ削減 (必要箇所のみ残存)

### 🚀 デプロイ
- Firebase Hosting へビルド (16ファイル) 安定化
- 一時的な index.html 欠落デプロイをクリーンビルド → 再デプロイで解消

---

## [2.0.0] - 2025-08-06 🌸

### 🎯 桜和高校教室予約システム (Owa-CBS) Firebase版リリース
React + TypeScript + Firebaseによる本格的な教室予約システムが完成

### ✨ 新機能
- 🌸 桜和高校ブランディング（カスタム桜ファビコン）
- React TypeScriptアーキテクチャ
- Firebase Authentication (Google OAuth)
- Firestore リアルタイムデータベース
- Firebase Hosting
- レスポンシブデザイン
- FullCalendar.js v6統合
- 管理者・教師ロール管理
- CSVエクスポート/インポート機能
- 予約の一括管理機能

### 🔧 技術仕様
- React 18 + TypeScript
- Firebase v9 SDK
- Material-UI コンポーネント
- モジュラーアーキテクチャ
- PWA対応（manifest.json）

### 📁 ファイル構成
```
firebase-app/classroom-reservation/
├── public/
│   ├── index.html (タイトル: Owa-CBS)
│   ├── manifest.json (桜和高校教室予約システム)
│   └── favicon.svg (桜デザイン)
├── src/
│   ├── components/ (React コンポーネント)
│   ├── firebase/ (Firebase設定)
│   ├── hooks/ (カスタムフック)
│   └── utils/ (ユーティリティ)
└── firebase.json (Hosting設定)
```

---

## [1.0.0] - 2025-07-30

### 🎯 シンプル版リリース (廃止)
Google Apps Scriptベースの教室予約システム（v2.0.0により置換）

### ✨ 追加機能
- FullCalendar.js v6.1.15によるカレンダー表示
- モーダルベースの予約作成・削除機能
- Google Calendar API統合
- 日本語ローカライゼーション
- レスポンシブデザイン対応
- ユーザー認証（Google OAuth）

### 🔧 技術改善
- ES5互換性の確保（Google Apps Script制約対応）
- z-indexによるモーダル表示問題の解決
- エラーハンドリングの基本実装
- コンソールログによるデバッグ機能

### 📁 ファイル構成
- `appsscript.json` - プロジェクト設定
- `Code.gs` - サーバーサイドロジック（ES5）
- `Views.html` - フロントエンドUI

---

## [0.2.0] - 開発段階（複雑版）

### 🚧 複雑版の試行錯誤
初期の包括的システム開発で直面した課題

### ❌ 遭遇した問題
- **ES5制約**: modern JavaScriptが使用不可
  - async/await構文エラー
  - アロー関数サポート不可
  - const/let宣言問題

- **UI複雑化**: 
  - 複数教室選択機能
  - 時間割システム（1〜8限）
  - CSV出力機能
  - スプレッドシート連携

- **モーダル表示問題**:
  - z-indexが未設定でカレンダー背面に表示
  - ユーザー入力が不可能な状態

### 🔄 対応策
- ES5互換コードへの全面書き換え
- 機能の大幅削減とシンプル化
- CSS z-index修正（9999/10000）

### 📚 学習成果
- Google Apps Script環境制約の理解
- MVPアプローチの重要性
- ユーザビリティ優先の設計思想

---

## [0.1.0] - 初期構想

### 💡 初期アイデア
「2〜3クリックで確実に予約・取消ができる仕組み」の実現

### 🎯 目標機能
- 直感的な操作性
- 高い信頼性
- シンプルなインターフェース
- Google Workspace統合

### 📋 計画された機能
- 教室管理システム
- 時間割ベースの予約
- 利用統計とレポート
- 管理者機能
- 通知システム

---

## 技術的な変遷

### Phase 1: 理想主義的アプローチ
- modern JavaScript使用
- 豊富な機能セット
- 複雑なデータ構造

### Phase 2: 現実的制約への適応
- ES5互換性確保
- Google Apps Script制約への対応
- 段階的機能削減

### Phase 3: シンプル化の徹底
- 最小限の機能に集約
- ユーザビリティ最優先
- 確実な動作の保証

---

## 今後のロードマップ

### v2.1.0 (候補)
- 繰り返し予約 / 通知 / 統計ダッシュボード
- 承認ワークフロー
- 単体テスト充実

**開発哲学**: "Perfect is the enemy of good" - 完璧を求めるより、まず動くものを作る
