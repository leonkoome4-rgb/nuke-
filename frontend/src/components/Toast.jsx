import { useCallback, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
let toastId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (message, type = "info") => {
      const id = toastId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3200)
      );
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}

export function ToastContainer({ toasts, dismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => dismiss(t.id)}>
            <Icon size={16} strokeWidth={2.25} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
