# CHANGELOG

## [2.1.0] - 2025-08-22
### ✨ 機能追加 / 改善
- 予約制限機能: 管理画面から「nヶ月先まで」の上限を設定。フォーム送信時の検証と Firestore ルールで二重に強制
- カレンダーUX: 上限日以降を非表示にせず「グレーアウト表示＋クリック不可」に変更
- 固定の毎週予約（テンプレート）管理を追加（管理者専用CRUD）
- テンプレート適用で事前に予約スロットを生成（template-lock）。一般ユーザーの新規予約をブロック
- 管理モーダル（RecurringTemplatesModal）でテンプレ管理＋ロック一括適用を統合

### 🖥️ UI/UX
- 予約フォームの時限セレクトで、予約済み/ロック済みの時限を自動でグレーアウト（選択不可）
- サイドパネルの管理セクションに「固定予約テンプレートを開く」ボタンを追加

### 🔧 クライアント/サービス
- reservationsService に `getSlotsForDate` を追加し、予約スロット（予約本体/ロック）を日付単位で取得
- useReservationData で同日に `reservations` と `slots` をロード。PeriodRangeSelector が両方を参照して占有判定
- recurringTemplatesService（CRUD）と templateLocks（ロック生成）を追加

### 🔒 Firestore ルール
- `recurring_templates` の read-all / write-admin を追加
- 予約作成は作成者一致＋上限日以内を必須（既存強化）

### 🐞 修正
- テンプレート保存時の `endDate: undefined` で発生する Firestore エラーを解消（payload サニタイズ）

### 🚀 デプロイ
- Hosting に反映（フォームの時限グレーアウト含む一連の変更）

## [2.0.3] - 2025-08-17
### 🎨 UI / 表示

## [1.2.0] - 2025-08-18
### ✅ 安定化/権限/重複防止
- 予約二重登録防止: スロット一意性（roomId_日付_時限）をトランザクションで保証
- Firestore ルール強化: 削除/更新は作成者のみ、管理者メール（212-schooladmin@e.osakamanabi.jp）は全件削除可
- UI: 予約直後の重複誤検知を防ぐクールダウンを2秒に調整
- フォーム: 予約完了後に教室選択をクリア

### 🧹 保守
- ESLint 警告の解消（依存の安定化）
- 管理者メールのUI反映（自動で isAdmin 判定）

### 🚀 デプロイ
- Firebase Hosting / Firestore Rules へ反映

### 🔡 表示順 / 文言
- カレンダーイベント: 表記を「時限 教室名」に変更
- 日別テーブル列:「時限 / 教室 / 時間 / 予約内容 / 予約者」に統一

### 🧰 内部 / 開発
- `utils/periodLabel.ts` の利用箇所を整理（表示一貫性）
- `ROADMAP.md` をリポジトリ直下に追加（今後の改善計画を明文化）

### 🚀 デプロイ
- Firebase Hosting へ反映

---

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
