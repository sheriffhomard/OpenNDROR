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
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pinned) {
            setPinned(false);
            setHovered(false);
          } else {
            setPinned(true);
          }
        }}
        aria-label={`Aide : ${title}`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute bottom-full mb-2 z-50 w-64 p-2.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] text-left shadow-md pointer-events-auto ${positionClass}`}
        >
          <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
            {title}
          </span>
          <span className="block text-xs leading-relaxed text-gray-600 dark:text-gray-300 font-normal normal-case">
            {description}
          </span>
        </span>
      )}
    </span>
  );
};
