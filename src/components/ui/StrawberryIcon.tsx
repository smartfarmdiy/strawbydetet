const StrawberryIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M32 8c-2 0-4 1-5 3-1 2-1 4 0 6l-3-1c-2 0-4 1-5 3s-1 4 0 6l8 4 5-3z"
      fill="hsl(var(--primary))"
    />
    <path
      d="M32 20c-12 0-20 10-20 24 0 10 8 16 20 16s20-6 20-16c0-14-8-24-20-24z"
      fill="hsl(var(--secondary))"
    />
    <circle cx="24" cy="32" r="2" fill="#fff5" />
    <circle cx="40" cy="32" r="2" fill="#fff5" />
    <circle cx="28" cy="40" r="2" fill="#fff5" />
    <circle cx="36" cy="40" r="2" fill="#fff5" />
    <circle cx="32" cy="48" r="2" fill="#fff5" />
    <circle cx="24" cy="46" r="1.5" fill="#fff5" />
    <circle cx="40" cy="46" r="1.5" fill="#fff5" />
  </svg>
);

export default StrawberryIcon;