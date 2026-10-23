/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Root component — owns the API connection status, theme state,
 * renders the top bar / tab navigation, and hosts the page router.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { Notifications } from './pages/Notifications';
import { WebView } from './pages/WebView';
import { Config } from './pages/Config';
import { Theme } from './pages/Theme';
import { Wallpaper } from './pages/Wallpaper';
import { SearchDashboard } from './pages/SearchDashboard';
import { ToastProvider } from './lib/toast';
import { api } from './api';

const TABS = [
    { path: '/notifications', label: 'Notifications' },
    { path: '/webview', label: 'WebView Content' },
    { path: '/config', label: 'Remote Config' },
    { path: '/theme', label: 'Theme' },
    { path: '/wallpaper', label: 'Wallpapers' },
    { path: '/search', label: 'Search Dashboard' },
] as const;

export function App() {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [theme, setTheme] = useState<string>(() => {
        // Load theme from localStorage, default to dark
        const saved = localStorage.getItem('ops-console-theme');
        return saved || 'dark';
    });

    useEffect(() => {
        // Apply theme to document root
        const root = document.documentElement;
        if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else {
            root.removeAttribute('data-theme');
        }
        // Persist theme preference
        localStorage.setItem('ops-console-theme', theme);
    }, [theme]);

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
            <TopBar connected={connected} theme={theme} onThemeChange={setTheme} />
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
                    <Route path="/wallpaper" element={<Wallpaper />} />
                    <Route path="/search" element={<SearchDashboard />} />
                    <Route path="*" element={<Navigate to="/notifications" replace />} />
                </Routes>
            </main>
        </ToastProvider>
    );
}
