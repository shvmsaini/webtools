/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Generic list-column state components (loading / empty / error).
 */

import React from 'react';

export function LoadingState() {
    return <div className="list-empty">Loading…</div>;
}

export function EmptyState({ text }: { text: string }) {
    return <div className="list-empty">{text}</div>;
}

export function ErrorState({ message }: { message: string }) {
    return <div className="list-empty list-empty--error">Failed to load: {message}</div>;
}
