/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Top bar — shows the backend connectivity status + the operator name,
 * and provides theme toggle (dark / light mode).
 */

import React from 'react';
import { api } from '../api';

interface Props {
    connected: boolean | null;
    theme?: string;
    onThemeChange?: (theme: string) => void;
}

export function TopBar({ connected, theme = 'dark', onThemeChange }: Props) {
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

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        onThemeChange?.(newTheme);
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
                <button
                    onClick={toggleTheme}
                    className="btn btn-sm btn-ghost"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    style={{ padding: '6px 10px' }}
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
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
