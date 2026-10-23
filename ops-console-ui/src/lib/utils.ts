/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Shared utility helpers — ISO-timestamp, default factory objects,
 * and class-name composition.
 */

import type { Display, Targeting } from '../types';

export function nowIso(): string {
    return new Date().toISOString();
}

export function emptyTargeting(): Targeting {
    return {
        audience: 'ALL',
        languages: [],
        seatNumbers: [],
        minAppVersion: null,
    };
}

export function defaultDisplay(): Display {
    return {
        mode: 'MODAL',
        showHeader: true,
        showCloseButton: true,
        width: '80%',
        height: '80%',
    };
}

export function cn(...names: ReadonlyArray<string | null | undefined | false>): string {
    return names.filter(Boolean).join(' ');
}
