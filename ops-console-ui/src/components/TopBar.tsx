/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Top bar — shows the backend connectivity status + the operator name,
 * and provides theme mode selector (auto / light / dark).
 */

import React from 'react';
import { api } from '../api';

export type ThemeMode = 'auto' | 'light' | 'dark';

interface Props {
    connected: boolean | null;
    theme?: ThemeMode;
    onThemeChange?: (theme: ThemeMode) => void;
}

export function TopBar({ connected, theme = 'auto', onThemeChange }: Props) {
    const [apiUrl, setApiUrl] = React.useState(api.baseUrl);
    const [operator, setOperator] = React.useState(api.operator);

    const saveUrl = (v: string) => {
        api.setBaseUrl(v);
        setApiUrl(api.baseUrl);
    };

    const saveOperator = (v: string) => {
        api.setOperator(v);
        setOperator(api.operator);
    };

    return (
        <header className="top-bar">
            <div className="top-bar__brand">
                <strong>Operations Console</strong>
                <span className="top-bar__subtitle">Leanback IFE</span>
            </div>
            <div className="top-bar__status">
                <span className={`top-bar__dot ${connected === true ? 'ok' : connected === false ? 'bad' : 'unknown'}`} />
                <span>{connected === true ? 'Connected' : connected === false ? 'Offline' : 'Connecting…'}</span>
            </div>
            <div className="top-bar__settings">
                {/* Theme mode: auto follows OS preference, light/dark are explicit. */}
                <select
                    className="btn btn-sm btn-ghost"
                    value={theme}
                    onChange={(e) => onThemeChange?.(e.target.value as ThemeMode)}
                    title="Theme mode — Auto follows your operating system"
                    style={{ padding: '6px 10px' }}
                    aria-label="Theme mode"
                >
                    <option value="auto">🖥️ Auto</option>
                    <option value="light">☀️ Light</option>
                    <option value="dark">🌙 Dark</option>
                </select>
                <input
                    type="text"
                    placeholder="API base URL"
                    value={apiUrl}
                    onChange={(e) => saveUrl(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Operator name"
                    value={operator}
                    onChange={(e) => saveOperator(e.target.value)}
                />
            </div>
        </header>
    );
}
