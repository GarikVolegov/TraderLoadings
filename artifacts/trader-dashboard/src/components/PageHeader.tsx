import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-3 pb-1">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold font-mono tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
