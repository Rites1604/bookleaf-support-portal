/** BookLeaf mark: coral tile with a white slash, as on bookleafpub.com. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#F16876" />
      <path d="M18.5 9 L13.5 23" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Mark plus the stacked "BookLeaf / Publishing" wordmark in the brand's light grey sans. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="BookLeaf Publishing">
      <LogoMark size={size} />
      <span className="flex flex-col font-light leading-[0.95] text-ink-muted" style={{ fontSize: size * 0.5 }}>
        <span>BookLeaf</span>
        <span>Publishing</span>
      </span>
    </span>
  );
}
