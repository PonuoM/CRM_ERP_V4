import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ── Types ──
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ConfirmOptions {
    type?: ToastType;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
}

interface ToastContextValue {
    toast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ── Context ──
const ToastContext = React.createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
    const ctx = React.useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
    return ctx;
};

// ── Config ──
const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; title: string }> = {
    success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500', title: 'text-green-800' },
    error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', title: 'text-red-800' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', title: 'text-amber-800' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', title: 'text-blue-800' },
};

const DEFAULT_DURATION: Record<ToastType, number> = {
    success: 4000,
    error: 6000,
    warning: 5000,
    info: 4000,
};

// ── Single Toast Component ──
const ToastCard: React.FC<{
    item: ToastItem;
    onClose: (id: string) => void;
}> = ({ item, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
        const dur = item.duration ?? DEFAULT_DURATION[item.type];
        if (dur > 0) {
            timerRef.current = setTimeout(() => {
                setIsLeaving(true);
                setTimeout(() => onClose(item.id), 300);
            }, dur);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClose = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsLeaving(true);
        setTimeout(() => onClose(item.id), 300);
    };

    const c = COLORS[item.type];

    return (
        <div
            className={`
        pointer-events-auto w-full max-w-sm rounded-xl border shadow-lg backdrop-blur-sm
        ${c.bg} ${c.border}
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
        >
            <div className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 flex-shrink-0 ${c.icon}`}>{ICONS[item.type]}</span>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${c.title}`}>{item.title}</p>
                    {item.message && (
                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-line leading-relaxed">{item.message}</p>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-black/5"
                >
                    <X size={16} />
                </button>
            </div>
            {/* Progress bar */}
            {(item.duration ?? DEFAULT_DURATION[item.type]) > 0 && (
                <div className="h-1 w-full rounded-b-xl overflow-hidden bg-black/5">
                    <div
                        className={`h-full ${c.icon.replace('text-', 'bg-')} opacity-40`}
                        style={{
                            animation: `toast-progress ${item.duration ?? DEFAULT_DURATION[item.type]}ms linear forwards`,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// ── Confirm Modal ──
const ConfirmModal: React.FC<{
    options: ConfirmOptions;
    onResolve: (result: boolean) => void;
}> = ({ options, onResolve }) => {
    const [isVisible, setIsVisible] = useState(false);
    const type = options.type || 'warning';
    const c = COLORS[type];

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleResolve = (result: boolean) => {
        setIsVisible(false);
        setTimeout(() => onResolve(result), 200);
    };

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-200
        ${isVisible ? 'bg-black/40' : 'bg-black/0'}`}
            onClick={() => handleResolve(false)}
        >
            <div
                className={`
          w-full max-w-md rounded-2xl border shadow-2xl bg-white
          ${c.border}
          transition-all duration-200
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`flex items-start gap-4 p-6 pb-4 ${c.bg} rounded-t-2xl border-b ${c.border}`}>
                    <div className={`p-2 rounded-xl ${c.bg} ${c.icon}`}>
                        {ICONS[type]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-base font-bold ${c.title}`}>{options.title}</h3>
                        {options.message && (
                            <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line leading-relaxed">{options.message}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-4">
                    <button
                        onClick={() => handleResolve(false)}
                        className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {options.cancelText || 'ยกเลิก'}
                    </button>
                    <button
                        onClick={() => handleResolve(true)}
                        className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm
              ${type === 'error' ? 'bg-red-500 hover:bg-red-600'
                                : type === 'warning' ? 'bg-amber-500 hover:bg-amber-600'
                                    : type === 'success' ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                        {options.confirmText || 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Provider ──
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [confirmState, setConfirmState] = useState<{
        options: ConfirmOptions;
        resolve: (v: boolean) => void;
    } | null>(null);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]); // max 5 visible
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setConfirmState({ options, resolve });
        });
    }, []);

    const handleConfirmResolve = useCallback((result: boolean) => {
        if (confirmState) {
            confirmState.resolve(result);
            setConfirmState(null);
        }
    }, [confirmState]);

    const ctx: ToastContextValue = {
        toast: addToast,
        success: (title, message) => addToast('success', title, message),
        error: (title, message) => addToast('error', title, message),
        warning: (title, message) => addToast('warning', title, message),
        info: (title, message) => addToast('info', title, message),
        confirm: showConfirm,
    };

    return (
        <ToastContext.Provider value={ctx}>
            {children}

            {/* Toast Stack */}
            <div className="fixed top-4 right-4 z-[9998] flex flex-col gap-3 pointer-events-none">
                {toasts.map(item => (
                    <ToastCard key={item.id} item={item} onClose={removeToast} />
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmState && (
                <ConfirmModal
                    options={confirmState.options}
                    onResolve={handleConfirmResolve}
                />
            )}

            {/* Progress bar animation */}
            <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
