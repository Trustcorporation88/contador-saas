import { FC, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
}

export const ResponsiveGrid: FC<ResponsiveGridProps> = ({
  children,
  className,
  cols = { sm: 1, md: 3, lg: 4 },
  gap = 6,
}) => {
  const gridCols = {
    sm: cols.sm ? `grid-cols-${cols.sm}` : 'grid-cols-1',
    md: cols.md ? `md:grid-cols-${cols.md}` : 'md:grid-cols-3',
    lg: cols.lg ? `lg:grid-cols-${cols.lg}` : 'lg:grid-cols-4',
    xl: cols.xl ? `xl:grid-cols-${cols.xl}` : '',
  };

  return (
    <div
      className={cn(
        'grid',
        gridCols.sm,
        gridCols.md,
        gridCols.lg,
        gridCols.xl,
        `gap-${gap}`,
        className
      )}
    >
      {children}
    </div>
  );
};
