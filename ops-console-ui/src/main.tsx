/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Entry point — sets up the React tree, the router, and the toast
 * surface. Mirrors the modular-interactive-seatback console.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
