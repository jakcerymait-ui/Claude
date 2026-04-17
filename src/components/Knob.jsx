import { useRef, useEffect, useCallback } from 'react';

const RANGE_DEG = 270;
const START_DEG = -135;

function polarToXY(cx, cy, r, deg) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, a1, a2) {
  const s = polarToXY(cx, cy, r, a1);
  const e = polarToXY(cx, cy, r, a2);
  const span = ((a2 - a1) % 360 + 360) % 360;
  const large = span > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export default function Knob({
  label, value, min = 0, max = 100, step = 1,
  onChange, unit = '', color = '#f97316', size = 64,
}) {
  const accRef = useRef(value);
  const dragging = useRef(false);
  const lastY = useRef(0);

  useEffect(() => { accRef.current = value; }, [value]);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    lastY.current = e.clientY;
    accRef.current = value;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [value]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dy = lastY.current - e.clientY;
    lastY.current = e.clientY;
    const delta = (dy / 150) * (max - min);
    const next = Math.min(max, Math.max(min, accRef.current + delta));
    accRef.current = next;
    onChange(Math.round(next / step) * step);
    e.preventDefault();
  }, [min, max, step, onChange]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  const norm = (value - min) / (max - min);
  const curDeg = START_DEG + norm * RANGE_DEG;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.34;
  const trackPath = describeArc(cx, cy, r, START_DEG, START_DEG + RANGE_DEG);
  const valuePath = norm > 0.001 ? describeArc(cx, cy, r, START_DEG, curDeg) : null;
  const dot = polarToXY(cx, cy, r * 0.62, curDeg);

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ userSelect: 'none' }}>
      <svg
        width={size} height={size}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <radialGradient id={`kg-${label}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#2e2e48" />
            <stop offset="100%" stopColor="#181826" />
          </radialGradient>
        </defs>
        {/* Body */}
        <circle cx={cx} cy={cy} r={cx - 2} fill={`url(#kg-${label})`} stroke="#3a3a56" strokeWidth="1" />
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#2a2a40" strokeWidth="3.5" strokeLinecap="round" />
        {/* Value arc */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${color}80)` }} />
        )}
        {/* Indicator dot */}
        <circle cx={dot.x} cy={dot.y} r={2.5} fill={color}
          style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
        {/* Center cap */}
        <circle cx={cx} cy={cy} r={size * 0.16} fill="#22223a" stroke="#3a3a56" strokeWidth="1" />
      </svg>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#8888aa', fontFamily: 'monospace', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 600 }}>
        {typeof value === 'number' ? value : value}{unit}
      </span>
    </div>
  );
}
