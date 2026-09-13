import { useState } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  return { toasts, addToast };
}

const ICONS = {
  success: <CheckCircle size={15} />,
  error:   <XCircle size={15} />,
  info:    <Info size={15} />,
};

export function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {ICONS[t.type] || ICONS.info}
          {t.message}
        </div>
      ))}
    </div>
  );
}
