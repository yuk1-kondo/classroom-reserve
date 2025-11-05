// アクセシビリティ向上ユーティリティ

/**
 * スクリーンリーダー専用メッセージを通知
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // 1秒後に削除
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * フォーカストラップ - モーダル内でのタブ移動を制限
 */
export const createFocusTrap = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  // 初期フォーカス
  firstElement?.focus();
  
  // クリーンアップ関数を返す
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * キーボードナビゲーション用ヘルパー
 */
export const handleArrowKeyNavigation = (
  e: React.KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onNavigate: (newIndex: number) => void
) => {
  let newIndex = currentIndex;
  
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault();
      newIndex = (currentIndex + 1) % items.length;
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault();
      newIndex = currentIndex - 1 < 0 ? items.length - 1 : currentIndex - 1;
      break;
    case 'Home':
      e.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      e.preventDefault();
      newIndex = items.length - 1;
      break;
    default:
      return;
  }
  
  items[newIndex]?.focus();
  onNavigate(newIndex);
};

/**
 * スクロール時のフォーカス維持
 */
export const scrollIntoViewIfNeeded = (element: HTMLElement, options?: ScrollIntoViewOptions) => {
  const rect = element.getBoundingClientRect();
  const isVisible = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
  
  if (!isVisible) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
      ...options
    });
  }
};

/**
 * アクセシブルな日付フォーマット
 */
export const formatDateAccessible = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
};

/**
 * aria-label生成ヘルパー
 */
export const generateAriaLabel = {
  reservation: (roomName: string, date: string, period: string) => 
    `${roomName}の予約、${date}、${period}`,
  
  deleteButton: (itemName: string) => 
    `${itemName}を削除`,
  
  editButton: (itemName: string) => 
    `${itemName}を編集`,
  
  closeButton: (dialogName?: string) => 
    dialogName ? `${dialogName}を閉じる` : '閉じる',
  
  loadingState: (context: string) => 
    `${context}を読み込み中`,
  
  errorState: (error: string) => 
    `エラー: ${error}`,
};

/**
 * カラーコントラスト検証（WCAG AA準拠）
 */
export const hasAccessibleContrast = (foreground: string, background: string): boolean => {
  // RGB値を取得
  const getRGB = (color: string) => {
    const hex = color.replace('#', '');
    return {
      r: parseInt(hex.substr(0, 2), 16) / 255,
      g: parseInt(hex.substr(2, 2), 16) / 255,
      b: parseInt(hex.substr(4, 2), 16) / 255,
    };
  };
  
  // 相対輝度を計算
  const getLuminance = (color: string) => {
    const { r, g, b } = getRGB(color);
    const [rs, gs, bs] = [r, g, b].map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  
  // WCAG AA: 通常テキスト 4.5:1, 大きいテキスト 3:1
  return ratio >= 4.5;
};
