import React from "react";
export function Icon({ name, size = 18 }) {
  const paths = {
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
