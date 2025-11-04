// エラーハンドリングのユーティリティ

/**
 * Firebaseエラーをユーザーフレンドリーなメッセージに変換
 * @param error エラーオブジェクト
 * @returns ユーザー向けエラーメッセージ
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Firebaseの一般的なエラーコードを日本語に変換
    if ('code' in error) {
      const code = (error as { code: string }).code;
      switch (code) {
        case 'permission-denied':
          return '権限がありません。ログインしているか確認してください。';
        case 'not-found':
          return '指定されたデータが見つかりません。';
        case 'already-exists':
          return 'すでに存在しています。';
        case 'failed-precondition':
          return '操作を実行できません。条件が満たされていません。';
        case 'unavailable':
          return 'サービスが一時的に利用できません。しばらくしてから再度お試しください。';
        case 'deadline-exceeded':
          return '処理がタイムアウトしました。もう一度お試しください。';
        case 'cancelled':
          return '操作がキャンセルされました。';
        default:
          return error.message;
      }
    }
    return error.message;
  }
  return '予期しないエラーが発生しました。';
}

/**
 * エラーをコンソールに記録し、ユーザーに通知
 * @param error エラーオブジェクト
 * @param context エラーが発生した文脈（例: '予約の作成'）
 */
export function handleError(error: unknown, context: string): void {
  console.error(`[${context}] エラー:`, error);
  const message = getErrorMessage(error);
  alert(`${context}中にエラーが発生しました:\n${message}`);
}

/**
 * 非同期処理をtry-catchでラップし、エラーを処理
 * @param fn 実行する非同期関数
 * @param context エラーが発生した文脈
 * @returns 成功時はtrue、失敗時はfalse
 */
export async function withErrorHandling(
  fn: () => Promise<void>,
  context: string
): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    handleError(error, context);
    return false;
  }
}

