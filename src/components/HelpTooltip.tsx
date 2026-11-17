import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
  align?: 'left' | 'center' | 'right';
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  title,
  description,
  align = 'center',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const positionClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`Help: ${title}`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute bottom-full mb-2 z-50 w-64 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left shadow-xl pointer-events-auto ${positionClass}`}
        >
          <span className="block text-[11px] font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
            {title}
          </span>
          <span className="block text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 font-normal normal-case">
            {description}
          </span>
        </span>
      )}
    </span>
  );
};
