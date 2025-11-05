// トースト通知管理用カスタムフック
import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback((message: string) => {
    return addToast('success', message);
  }, [addToast]);

  const error = useCallback((message: string) => {
    return addToast('error', message);
  }, [addToast]);

  const warning = useCallback((message: string) => {
    return addToast('warning', message);
  }, [addToast]);

  const info = useCallback((message: string) => {
    return addToast('info', message);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };
};
