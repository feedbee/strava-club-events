import React from "react";
export function Icon({ name, size = 18 }) {
  const paths = {
    close: <path d="M6 6l12 12M18 6L6 18" />,
    month: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2M14 17h2" /></>,
    week: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v11M15 10v11M7 3v4M17 3v4" /></>,
    day: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M7 3v4M17 3v4M8 14h8M8 17h8" /></>,
    list: <path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" />,
    event: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="5" r="2" />
        <circle cx="18" cy="19" r="2" />
        <path d="M6 7v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v1" />
      </>
    ),
    external: (
      <path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    ),
    filter: <path d="M3 4h18l-7 8v7l-4 2v-9z" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
