import React, { useState } from 'react';

export interface ChartDataPoint {
  time: string;
  timestamp: number;
  value: number;
  secondaryValue?: number;
}

interface RealtimeChartProps {
  data: ChartDataPoint[];
  title: string;
  unit: string;
  minLimit?: number;
  maxLimit?: number;
  targetLine?: number;
  color?: string;
  secondaryColor?: string;
  secondaryLabel?: string;
  primaryLabel?: string;
  height?: number;
}

export const RealtimeChart: React.FC<RealtimeChartProps> = ({
  data,
  title,
  unit,
  minLimit,
  maxLimit,
  targetLine,
  color = '#06b6d4',
  secondaryColor = '#8b5cf6',
  primaryLabel = 'Value',
  secondaryLabel = 'Secondary',
  height = 200,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center bg-slate-900/60 rounded-xl border border-slate-800 text-slate-500 text-xs font-mono"
        style={{ height }}
      >
        Waiting for sensor data stream...
      </div>
    );
  }

  // Calculate scales
  const allValues = data.flatMap((d) => [d.value, d.secondaryValue].filter((v): v is number => v !== undefined));
  if (minLimit !== undefined) allValues.push(minLimit);
  if (maxLimit !== undefined) allValues.push(maxLimit);
  if (targetLine !== undefined) allValues.push(targetLine);

  const minVal = Math.floor(Math.min(...allValues) - 0.5);
  const maxVal = Math.ceil(Math.max(...allValues) + 0.5);
  const range = maxVal - minVal || 1;

  const padding = { top: 20, right: 30, bottom: 30, left: 45 };
  const chartWidth = 700;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const getX = (index: number) => padding.left + (index / Math.max(1, data.length - 1)) * innerWidth;
  const getY = (val: number) => padding.top + innerHeight - ((val - minVal) / range) * innerHeight;

  // Build path for primary value
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`);
  const primaryPath = `M ${points.join(' L ')}`;
  const areaPath = `${primaryPath} L ${getX(data.length - 1)},${padding.top + innerHeight} L ${getX(0)},${padding.top + innerHeight} Z`;

  // Build path for secondary value if present
  const hasSecondary = data.some((d) => d.secondaryValue !== undefined);
  const secondaryPoints = data
    .map((d, i) => (d.secondaryValue !== undefined ? `${getX(i)},${getY(d.secondaryValue)}` : null))
    .filter(Boolean);
  const secondaryPath = secondaryPoints.length > 0 ? `M ${secondaryPoints.join(' L ')}` : '';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            {title}
          </span>
          <span className="text-[10px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-mono">
            {data[data.length - 1]?.value.toFixed(1)} {unit}
          </span>
        </div>

        <div className="flex items-center space-x-4 text-[10px] font-mono text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{primaryLabel}</span>
          </div>
          {hasSecondary && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
          )}
          {targetLine !== undefined && (
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-emerald-400" />
              <span>Target ({targetLine}{unit})</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + innerHeight * pct;
            const val = maxVal - pct * range;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Acceptable Safe Zone Band (e.g. 2°C - 8°C for Vaccines) */}
          {minLimit !== undefined && maxLimit !== undefined && (
            <rect
              x={padding.left}
              y={getY(maxLimit)}
              width={innerWidth}
              height={Math.max(0, getY(minLimit) - getY(maxLimit))}
              fill="#10b981"
              fillOpacity="0.06"
              stroke="#10b981"
              strokeOpacity="0.2"
              strokeDasharray="2 2"
            />
          )}

          {/* Target setpoint horizontal dashed line */}
          {targetLine !== undefined && (
            <line
              x1={padding.left}
              y1={getY(targetLine)}
              x2={chartWidth - padding.right}
              y2={getY(targetLine)}
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
          )}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#grad-${title.replace(/\s+/g, '')})`} />

          {/* Secondary line if present */}
          {hasSecondary && (
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.8"
              strokeDasharray="4 3"
            />
          )}

          {/* Primary stroke path */}
          <path d={primaryPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

          {/* Hover interaction points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.value);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="4"
                className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer fill-cyan-400 stroke-slate-900 stroke-2"
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 bg-slate-950/95 border border-slate-700 p-2 rounded-lg text-xs font-mono shadow-2xl pointer-events-none">
            <div className="text-slate-400 text-[10px]">{hoveredPoint.time}</div>
            <div className="text-white font-bold">
              {hoveredPoint.value.toFixed(2)} {unit}
            </div>
            {hoveredPoint.secondaryValue !== undefined && (
              <div className="text-purple-400 text-[11px]">
                {secondaryLabel}: {hoveredPoint.secondaryValue.toFixed(1)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer labels */}
      <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
        <span>{data[0]?.time || 'T-start'}</span>
        <span>Live Rolling Stream ({data.length} samples)</span>
        <span>{data[data.length - 1]?.time || 'T-now'}</span>
      </div>
    </div>
  );
};
