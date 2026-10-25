import React from 'react';

interface CircularGaugeProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
  secondaryText?: string;
  size?: number;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  min,
  max,
  label,
  unit,
  color = '#06b6d4',
  secondaryText,
  size = 140,
}) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  // 240 degree gauge arc
  const startAngle = 150;
  const arcSweep = 240;
  const clampedVal = Math.min(Math.max(value, min), max);
  const percentage = (clampedVal - min) / (max - min || 1);
  const strokeDashoffset = circumference - (arcSweep / 360) * percentage * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (arcSweep / 360) * circumference}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
        />

        {/* Active colored value arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Center Digital Readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-extrabold font-mono text-white tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        <span className="text-[10px] font-mono text-slate-400 -mt-0.5">{unit}</span>
      </div>

      {/* Label and Subtext */}
      <div className="text-center mt-1">
        <div className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">{label}</div>
        {secondaryText && <div className="text-[11px] text-slate-400 font-mono">{secondaryText}</div>}
      </div>
    </div>
  );
};
