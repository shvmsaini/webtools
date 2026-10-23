/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Generic editor field components shared across the dashboard pages.
 */

import React from 'react';

interface TextFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    hint?: string;
    required?: boolean;
    full?: boolean;
    type?: 'text' | 'url' | 'number';
    placeholder?: string;
    maxLength?: number;
}

export function TextField({
    label,
    value,
    onChange,
    hint,
    required,
    full,
    type = 'text',
    placeholder,
    maxLength,
}: TextFieldProps) {
    return (
        <label className={`editor-field ${full ? 'editor-field--full' : ''}`}>
            <span className="editor-field__label">
                {label}
                {hint && <small className="editor-field__hint"> {hint}</small>}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                placeholder={placeholder}
                maxLength={maxLength}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    );
}

interface TextareaFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    full?: boolean;
    maxLength?: number;
}

export function TextareaField({ label, value, onChange, full, maxLength }: TextareaFieldProps) {
    return (
        <label className={`editor-field ${full ? 'editor-field--full' : ''}`}>
            <span className="editor-field__label">{label}</span>
            <textarea
                value={value}
                maxLength={maxLength}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
            />
        </label>
    );
}

interface SelectFieldProps<T extends string> {
    label: string;
    value: T;
    onChange: (v: T) => void;
    options: ReadonlyArray<{ value: T; label: string }>;
}

export function SelectField<T extends string>({
    label,
    value,
    onChange,
    options,
}: SelectFieldProps<T>) {
    return (
        <label className="editor-field">
            <span className="editor-field__label">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

interface CheckboxFieldProps {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}

export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
    return (
        <label className="editor-field editor-field--checkbox">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="editor-field__label">{label}</span>
        </label>
    );
}
