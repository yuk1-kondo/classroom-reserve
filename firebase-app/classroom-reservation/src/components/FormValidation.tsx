// フォーム検証フィードバックコンポーネント
import React from 'react';
import './FormValidation.css';

export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

interface ValidationFeedbackProps {
  status: ValidationStatus;
  message?: string;
  showIcon?: boolean;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({ 
  status, 
  message,
  showIcon = true 
}) => {
  if (status === 'idle' || !message) return null;

  const icons = {
    validating: '⏳',
    success: '✓',
    error: '✕',
    warning: '⚠'
  };

  return (
    <div className={`validation-feedback validation-${status}`} role="alert">
      {showIcon && <span className="validation-icon" aria-hidden="true">{icons[status]}</span>}
      <span className="validation-message">{message}</span>
    </div>
  );
};

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  warning?: string;
  success?: string;
  hint?: string;
  validating?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ 
  label, 
  required = false,
  error,
  warning,
  success,
  hint,
  validating = false,
  children,
  htmlFor
}) => {
  const getStatus = (): ValidationStatus => {
    if (validating) return 'validating';
    if (error) return 'error';
    if (warning) return 'warning';
    if (success) return 'success';
    return 'idle';
  };

  const status = getStatus();
  const feedbackMessage = error || warning || success;

  return (
    <div className={`form-field ${status !== 'idle' ? `field-${status}` : ''}`}>
      <label htmlFor={htmlFor} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="必須">*</span>}
      </label>
      
      <div className="form-input-wrapper">
        {children}
        {validating && (
          <div className="input-validating-indicator" aria-label="検証中">
            <div className="spinner small">
              <div className="spinner-circle"></div>
            </div>
          </div>
        )}
      </div>

      {hint && !feedbackMessage && (
        <div className="form-hint">{hint}</div>
      )}
      
      {feedbackMessage && (
        <ValidationFeedback 
          status={status} 
          message={feedbackMessage}
        />
      )}
    </div>
  );
};

interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ 
  type, 
  message, 
  onClose,
  duration = 5000 
}) => {
  React.useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div 
      className={`toast toast-${type}`} 
      role="alert"
      aria-live="polite"
    >
      <span className="toast-icon" aria-hidden="true">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      {onClose && (
        <button 
          className="toast-close" 
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
      )}
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>;
  onRemove: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  toasts, 
  onRemove,
  position = 'top-right'
}) => {
  return (
    <div className={`toast-container toast-${position}`}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};
