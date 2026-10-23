/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * A simple SVG-based pie chart for visualizing search result
 * distribution across categories. No external chart libraries
 * are used to keep the bundle small.
 */

import { useMemo } from 'react';

interface PieSlice {
    label: string;
    value: number;
    color: string;
}

interface SearchPieChartProps {
    data: Array<{ label: string; value: number }>;
    title?: string;
}

const DEFAULT_COLORS = [
    '#E91E63', // Pink - Movies
    '#9C27B0', // Purple - TV
    '#3F51B5', // Indigo - Games
    '#2196F3', // Blue - Audio
    '#4CAF50', // Green - Other
    '#FF9800', // Orange
    '#795548', // Brown
];

export function SearchPieChart({ data, title }: SearchPieChartProps) {
    const slices = useMemo(() => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return [];

        let startAngle = -90; // Start at top
        return data.map((d, idx) => {
            const percentage = d.value / total;
            const sweepAngle = percentage * 360;
            const endAngle = startAngle + sweepAngle;

            // Convert angles to radians for SVG arc calculation
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const cx = 100;
            const cy = 100;
            const r = 80;

            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);

            const largeArc = sweepAngle > 180 ? 1 : 0;

            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            const slice: PieSlice = {
                label: d.label,
                value: d.value,
                color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
            };

            startAngle = endAngle;
            return { ...slice, path, percentage };
        });
    }, [data]);

    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <div className="config-card">
            {title && <h3>{title}</h3>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                    {slices.length === 0 ? (
                        <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            stroke="#333"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                        />
                    ) : (
                        <>
                            {slices.map((slice, idx) => (
                                <path
                                    key={idx}
                                    d={slice.path}
                                    fill={slice.color}
                                    stroke="#1a1a1a"
                                    strokeWidth="1"
                                />
                            ))}
                            {/* Inner circle for donut effect */}
                            <circle cx="100" cy="100" r="40" fill="#2a2a2a" />
                            <text
                                x="100"
                                y="105"
                                textAnchor="middle"
                                fill="white"
                                fontSize="20"
                                fontWeight="bold"
                            >
                                {total}
                            </text>
                        </>
                    )}
                </svg>
                <div style={{ flex: 1 }}>
                    {slices.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No data yet
                        </p>
                    ) : (
                        <table style={{ width: '100%' }}>
                            <tbody>
                                {slices.map((slice, idx) => (
                                    <tr key={idx}>
                                        <td style={{ padding: '4px 8px' }}>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    width: '14px',
                                                    height: '14px',
                                                    backgroundColor: slice.color,
                                                    marginRight: '8px',
                                                    borderRadius: '2px',
                                                }}
                                            />
                                            <strong>{slice.label}</strong>
                                        </td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {slice.value} (
                                                {Math.round(slice.percentage * 100)}%)
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
