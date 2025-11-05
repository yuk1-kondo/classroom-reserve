// ロギングユーティリティ
// 開発環境でのみログを出力し、本番環境では抑制する

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * デバッグログ（開発環境のみ）
   */
  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * 情報ログ（開発環境のみ）
   */
  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * 警告ログ（常に出力）
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  /**
   * エラーログ（常に出力）
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },

  /**
   * Firestoreクエリログ（開発環境のみ）
   */
  firestoreQuery: (collection: string, params: Record<string, unknown>): void => {
    if (isDevelopment) {
      console.log('🔥 Firestore query:', { collection, ...params });
    }
  },

  /**
   * パフォーマンスログ（開発環境のみ）
   */
  performance: (label: string, duration: number): void => {
    if (isDevelopment) {
      console.log(`⏱️ ${label}: ${duration}ms`);
    }
  }
};
