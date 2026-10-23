/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Lightweight toast hook — single-element transient notification UI
 * used by every dashboard page. Toasts are surfaced through a
 * React context so any descendant can pop a message and the
 * surface lives at the root of the tree (App.tsx).
 */

import React from 'react';

export type ToastKind = 'success' | 'error' | 'warning';

interface ToastState {
    id: number;
    kind: ToastKind;
    text: string;
}

interface ToastContextValue {
    toast: ToastState | null;
    show: (text: string, kind?: ToastKind) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = React.useState<ToastState | null>(null);

    React.useEffect(() => {
        if (toast === null) return;
        const id = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(id);
    }, [toast]);

    const show = React.useCallback((text: string, kind: ToastKind = 'success') => {
        setToast({ id: ++counter, kind, text });
    }, []);

    return (
        <ToastContext.Provider value={{ toast, show }}>
            {children}
            <ToastSurface toast={toast} />
        </ToastContext.Provider>
    );
}

export function useToast(): (text: string, kind?: ToastKind) => void {
    const ctx = React.useContext(ToastContext);
    if (ctx) return ctx.show;
    // Fallback: no provider mounted yet (e.g. in tests). Log so we don't
    // silently drop the message.
    return (text: string) => {
        // eslint-disable-next-line no-console
        console.warn('useToast: ToastProvider not mounted, dropped:', text);
    };
}

export function ToastSurface({ toast }: { toast: ToastState | null }) {
    if (toast === null) return null;
    return (
        <div className={`toast toast--${toast.kind}`} role="status" aria-live="polite">
            {toast.text}
        </div>
    );
}
