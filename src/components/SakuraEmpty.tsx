/**
 * 樱花空状态插画：三片花瓣落在软垫上。
 * 纯 SVG + token 填色，无外部资源；仅作装饰（aria-hidden）。
 */
export function SakuraEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="grid place-items-center px-4 py-10 text-center">
      <svg
        viewBox="0 0 120 78"
        className="h-20 w-32"
        aria-hidden="true"
        fill="none"
      >
        <ellipse cx="60" cy="70" rx="36" ry="6" fill="var(--chip)" />
        <g fill="var(--sakura-petal)">
          <path
            d="M40 22 C47 27 47 36 40 41 C33 36 33 27 40 22 Z"
            fillOpacity="0.9"
            transform="rotate(-14 40 31)"
          />
          <path
            d="M63 12 C70 17 70 26 63 31 C56 26 56 17 63 12 Z"
            fillOpacity="0.62"
            transform="rotate(9 63 21)"
          />
          <path
            d="M84 30 C91 35 91 44 84 49 C77 44 77 35 84 30 Z"
            fillOpacity="0.42"
            transform="rotate(24 84 39)"
          />
        </g>
      </svg>
      <div className="mt-3 text-lg font-medium text-[var(--ink)]">{title}</div>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
