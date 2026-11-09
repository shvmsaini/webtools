/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Reusable targeting editor — audience, languages, seat numbers, and
 * min app version. Pages render this so a per-seat override, a
 * language-filtered announcement, and a cabin-class-targeted theme all
 * use the exact same UI and serialise to the same wire shape.
 *
 * The component is intentionally small: it's a group of fields, not a
 * stateful page. Owners pass [value] (the current Targeting) and
 * [onChange] (a setter that produces a new Targeting).
 */

import { SelectField, TextField } from './EditorField';
import type { Audience, Targeting } from '../types';

export const AUDIENCES: ReadonlyArray<{ value: Audience; label: string }> = [
    { value: 'ALL', label: 'All Seats' },
    { value: 'FIRST', label: 'First Class' },
    { value: 'BUSINESS', label: 'Business' },
    { value: 'ECONOMY', label: 'Economy' },
];

interface TargetingSectionProps {
    value: Targeting;
    onChange: (next: Targeting) => void;
    /**
     * Optional override of the section heading. Defaults to "Targeting".
     * Useful when an editor wants to make the broadcast-vs-targeted
     * distinction explicit ("Targeting (leave blank to broadcast)").
     */
    heading?: string;
    /**
     * Optional description copy. Replaces the default "leave fields blank
     * to target the entire fleet" hint when supplied.
     */
    helpText?: string;
}

/**
 * Joins a list of strings with comma+space, used as the display value
 * for the languages / seat-numbers text inputs. Empty list → empty
 * string so the input doesn't show ", " on first render.
 */
function joinList(items: string[]): string {
    return items.join(', ');
}

export function TargetingSection({ value, onChange, heading, helpText }: TargetingSectionProps) {
    const langs = joinList(value.languages);
    const seats = joinList(value.seatNumbers);

    return (
        <div className="form-section">
            <h3>{heading ?? 'Targeting'}</h3>
            <div className="form-section__help">
                {helpText ?? 'Leave fields blank to broadcast to the entire fleet. ' +
                    'Set any field to restrict this payload to matching seats only.'}
            </div>
            <div className="form-grid">
                <SelectField
                    label="Audience"
                    value={value.audience}
                    onChange={(v) => onChange({ ...value, audience: v })}
                    options={AUDIENCES}
                />
                <TextField
                    label="Languages (ISO codes)"
                    hint="comma-separated"
                    value={langs}
                    onChange={(v) =>
                        onChange({
                            ...value,
                            languages: v.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                    }
                    placeholder="en, ar, ja"
                />
                <TextField
                    label="Seat numbers"
                    hint="comma-separated"
                    full
                    value={seats}
                    onChange={(v) =>
                        onChange({
                            ...value,
                            seatNumbers: v.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                    }
                    placeholder="12A, 12B, 14C"
                />
                <TextField
                    label="Min app version"
                    hint="optional"
                    value={value.minAppVersion ?? ''}
                    onChange={(v) =>
                        onChange({ ...value, minAppVersion: v.trim() || null })
                    }
                    placeholder="1.2.3"
                />
            </div>
        </div>
    );
}
