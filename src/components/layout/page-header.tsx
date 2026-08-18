import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground font-ui">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
