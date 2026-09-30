export function ConsentBrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary text-[#171717] ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="size-[72%]"
        fill="none"
      >
        <path
          d="M10 9h28c12.6 0 20 8.1 20 20.6v5.8C58 47.9 50.6 56 38 56H27V44.5h11c5.5 0 8.5-3.2 8.5-9.1v-5.8c0-5.9-3-9.1-8.5-9.1H10V9Z"
          fill="currentColor"
        />
        <path
          d="M10 29.5h15.2l-4.7 13V57L10 64V29.5Z"
          fill="currentColor"
        />
        <path d="m25 24 18 10-18 10V24Z" fill="#fff7f2" />
      </svg>
    </span>
  );
}
