/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Root component — owns the API connection status, theme state,
 * renders the top bar / tab navigation, and hosts the page router.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TopBar, ThemeMode } from './components/TopBar';
import { Notifications } from './pages/Notifications';
import { WebView } from './pages/WebView';
import { Config } from './pages/Config';
import { Theme } from './pages/Theme';
import { ApkUpdates } from './pages/ApkUpdates';
import { SearchDashboard } from './pages/SearchDashboard';
import { QuizResponseDashboard } from './pages/QuizResponseDashboard';
import { SeatPingDashboard } from './pages/SeatPingDashboard';
import { ToastProvider } from './lib/toast';
import { api } from './api';

const TABS = [
    { path: '/notifications', label: 'Notifications' },
    { path: '/webview', label: 'WebView Content' },
    { path: '/config', label: 'Remote Config' },
    { path: '/theme', label: 'Theme' },
    { path: '/apk', label: 'APK Updates' },
    { path: '/search', label: 'Search Dashboard' },
    { path: '/seats', label: 'Seats' },
    { path: '/quiz', label: 'Quiz Analytics' },
] as const;

const STORAGE_KEY_THEME = 'ops-console-theme';

/** Resolves the user-stored theme mode, defaulting to 'auto'. */
function loadThemeMode(): ThemeMode {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    return 'auto';
}

/**
 * Resolves a theme mode to the actual color scheme that should be
 * applied right now. 'auto' follows the OS preference.
 */
function resolveMode(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'auto') {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: light)').matches
                ? 'light'
                : 'dark';
        }
        return 'dark';
    }
    return mode;
}

export function App() {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode);

    // Apply the resolved theme to <html data-theme="...">. When in 'auto'
    // we also subscribe to the OS preference so the dashboard flips in
    // real time as the user toggles their system theme.
    useEffect(() => {
        const root = document.documentElement;
        const apply = (resolved: 'light' | 'dark') => {
            if (resolved === 'light') {
                root.setAttribute('data-theme', 'light');
            } else {
                root.removeAttribute('data-theme');
            }
        };
        apply(resolveMode(themeMode));
        localStorage.setItem(STORAGE_KEY_THEME, themeMode);

        if (themeMode !== 'auto') return;
        const mql = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = () => apply(resolveMode('auto'));
        // Safari < 14 only supports addListener; modern browsers use addEventListener.
        if (mql.addEventListener) {
            mql.addEventListener('change', onChange);
            return () => mql.removeEventListener('change', onChange);
        }
        mql.addListener(onChange);
        return () => mql.removeListener(onChange);
    }, [themeMode]);

    useEffect(() => {
        let cancelled = false;
        async function check() {
            const ok = await api.health();
            if (!cancelled) setConnected(ok);
        }
        check();
        const id = setInterval(check, 15_000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    const location = useLocation();

    return (
        <ToastProvider>
            <TopBar connected={connected} theme={themeMode} onThemeChange={setThemeMode} />
            <nav className="tabs">
                {TABS.map((t) => {
                    const active = location.pathname.startsWith(t.path);
                    return (
                        <Link
                            key={t.path}
                            to={t.path}
                            className={`tab ${active ? 'active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>
            <main className="main">
                <Routes>
                    <Route path="/" element={<Navigate to="/notifications" replace />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/webview" element={<WebView />} />
                    <Route path="/config" element={<Config />} />
                    <Route path="/theme" element={<Theme />} />
                    <Route path="/apk" element={<ApkUpdates />} />

                    <Route path="/search" element={<SearchDashboard />} />
                    <Route path="/seats" element={<SeatPingDashboard />} />
                    <Route path="/quiz" element={<QuizResponseDashboard />} />
                    <Route path="*" element={<Navigate to="/notifications" replace />} />
                </Routes>
            </main>
        </ToastProvider>
    );
}
