import React, { useCallback, useRef, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';

/** Draggable bucket visual, extracted from AllocationBuckets.jsx (investments) —
 * see docs/groups/02-phase2-ui-and-splits-plan.md Debate M. Same look, generic ids. */
const COLORS = {
  indigo: { bgLight: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700', gradient: 'bg-gradient-to-t from-indigo-600 to-indigo-400', ring: 'ring-indigo-300' },
  emerald: { bgLight: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', gradient: 'bg-gradient-to-t from-emerald-600 to-emerald-400', ring: 'ring-emerald-300' },
  blue: { bgLight: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', gradient: 'bg-gradient-to-t from-blue-600 to-blue-400', ring: 'ring-blue-300' },
  amber: { bgLight: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', gradient: 'bg-gradient-to-t from-amber-600 to-amber-400', ring: 'ring-amber-300' },
};

export const Bucket = ({ label, value, total, isLocked, color = 'indigo', onChange, onToggleLock, formatValue }) => {
  const [isActive, setIsActive] = useState(false);
  const dragRef = useRef({ startY: 0, startValue: 0 });
  const percent = total > 0 ? (value / total) * 100 : 0;
  const colors = COLORS[color] || COLORS.indigo;

  const handleDragStart = useCallback((e) => {
    if (isLocked) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startY: clientY, startValue: value };
    setIsActive(true);

    const handleMove = (moveEvent) => {
      const moveY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaPercent = (dragRef.current.startY - moveY) / 2;
      onChange(dragRef.current.startValue + (deltaPercent / 100) * total);
    };
    const handleEnd = () => {
      setIsActive(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  }, [isLocked, value, total, onChange]);

  return (
    <div className="flex flex-col items-center flex-1 min-w-[64px]">
      <div className="text-center mb-2 h-9 flex flex-col justify-end">
        <span className={`font-semibold text-xs truncate max-w-[80px] ${colors.text}`}>{label}</span>
      </div>
      <div
        className={`relative w-16 h-32 rounded-xl border-2 ${colors.border} ${colors.bgLight} overflow-hidden transition-all cursor-ns-resize select-none ${isActive ? `ring-4 ${colors.ring} scale-105` : ''} ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className={`absolute bottom-0 left-0 right-0 ${colors.gradient} transition-all duration-150 ease-out`} style={{ height: `${percent}%` }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-1">
          <span className={`text-xs font-bold text-center ${percent > 50 ? 'text-white' : colors.text} drop-shadow-sm`}>
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
        {isLocked && (
          <div className="absolute top-1.5 end-1.5 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      {onToggleLock && (
        <button
          type="button"
          onClick={onToggleLock}
          className={`mt-2 p-1.5 rounded-lg ${isLocked ? 'bg-slate-700 text-white' : `${colors.bgLight} ${colors.text}`}`}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
};
