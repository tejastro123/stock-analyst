import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur || 5000),
    warn:    (msg, dur) => addToast(msg, 'warn', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span className="toast-icon">
              {t.type === 'success' && '✓'}
              {t.type === 'error'   && '⚠'}
              {t.type === 'warn'    && '⚡'}
              {t.type === 'info'    && '●'}
            </span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
