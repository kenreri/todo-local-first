import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-5 pb-1 pt-1">
      <div className="min-w-0 max-w-full">
        <h1 className="text-[28px] leading-9 font-bold tracking-[-0.03em] text-[var(--ink)] md:text-[34px] md:leading-[42px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-[22px] text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 pb-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
