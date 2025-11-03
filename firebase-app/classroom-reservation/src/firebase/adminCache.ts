// 管理者権限チェックのキャッシュ管理クラス
// 型安全で効率的なキャッシュ管理を提供

/**
 * AdminCache - 管理者権限チェックのキャッシュ管理
 * 
 * 機能:
 * - isAdmin / isSuperAdmin の結果をキャッシュ
 * - インフライトリクエストの重複排除
 * - 型安全なキャッシュ管理
 */
export class AdminCache {
  private isAdminCache = new Map<string, boolean>();
  private isAdminInflight = new Map<string, Promise<boolean>>();
  private isSuperCache = new Map<string, boolean>();
  private isSuperInflight = new Map<string, Promise<boolean>>();

  /**
   * キャッシュまたは計算結果を取得
   * @param key - キャッシュキー
   * @param cache - 結果キャッシュ
   * @param inflight - インフライトリクエストキャッシュ
   * @param compute - 実際の計算関数
   * @returns 計算結果
   */
  async getOrCompute<T>(
    key: string,
    cache: Map<string, T>,
    inflight: Map<string, Promise<T>>,
    compute: () => Promise<T>
  ): Promise<T> {
    // 1. キャッシュチェック（最速）
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    // 2. インフライトチェック（重複リクエスト防止）
    if (inflight.has(key)) {
      return await inflight.get(key)!;
    }
    
    // 3. 計算実行
    const promise = compute();
    inflight.set(key, promise);
    
    try {
      const result = await promise;
      cache.set(key, result);
      return result;
    } finally {
      inflight.delete(key);
    }
  }

  /**
   * isAdmin の結果をキャッシュから取得または計算
   */
  async getIsAdmin(key: string, compute: () => Promise<boolean>): Promise<boolean> {
    return this.getOrCompute(key, this.isAdminCache, this.isAdminInflight, compute);
  }

  /**
   * isSuperAdmin の結果をキャッシュから取得または計算
   */
  async getIsSuperAdmin(key: string, compute: () => Promise<boolean>): Promise<boolean> {
    return this.getOrCompute(key, this.isSuperCache, this.isSuperInflight, compute);
  }

  /**
   * すべてのキャッシュをクリア
   */
  clear(): void {
    this.isAdminCache.clear();
    this.isAdminInflight.clear();
    this.isSuperCache.clear();
    this.isSuperInflight.clear();
  }

  /**
   * isAdmin キャッシュのみクリア
   */
  clearIsAdmin(): void {
    this.isAdminCache.clear();
    this.isAdminInflight.clear();
  }

  /**
   * isSuperAdmin キャッシュのみクリア
   */
  clearIsSuperAdmin(): void {
    this.isSuperCache.clear();
    this.isSuperInflight.clear();
  }
}

// シングルトンインスタンス
export const adminCache = new AdminCache();

