import React from 'react';

interface AppLogoProps {
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-9 h-9' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ndrBgGrad" x1="48" y1="32" x2="464" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="60%" stopColor="#0b1f24" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="ndrShieldGrad" x1="128" y1="72" x2="384" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="ndrPulseGrad" x1="140" y1="256" x2="372" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#ndrBgGrad)" />
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        stroke="#10b981"
        strokeOpacity="0.35"
        strokeWidth="8"
      />
      <path
        d="M256 82L394 134V248C394 337 334 405 256 434C178 405 118 337 118 248V134L256 82Z"
        fill="#09111a"
        fillOpacity="0.82"
        stroke="url(#ndrShieldGrad)"
        strokeWidth="16"
        strokeLinejoin="round"
      />
      <circle
        cx="256"
        cy="248"
        r="76"
        stroke="#10b981"
        strokeOpacity="0.25"
        strokeWidth="4"
        strokeDasharray="8 8"
      />
      <circle cx="256" cy="248" r="44" stroke="#38bdf8" strokeOpacity="0.28" strokeWidth="3" />
      <path
        d="M150 250H194L220 198L252 302L284 218L306 250H362"
        stroke="url(#ndrPulseGrad)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="150" cy="250" r="11" fill="#38bdf8" />
      <circle cx="256" cy="128" r="10" fill="#34d399" />
      <circle cx="362" cy="250" r="11" fill="#34d399" />
      <circle cx="252" cy="302" r="9" fill="#ffffff" />
    </svg>
  );
};
