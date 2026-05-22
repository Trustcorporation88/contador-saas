import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const;

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Carregando...',
}) => (
  <div className="flex flex-col items-center justify-center gap-2" aria-busy="true">
    <svg
      className={`${SIZE_CLASSES[size]} animate-spin text-primary-600`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    {label && <p className="text-xs text-gray-500">{label}</p>}
  </div>
);

/** Full-page loading overlay */
export const PageLoader: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" label="Carregando Pro Contador..." />
  </div>
);
