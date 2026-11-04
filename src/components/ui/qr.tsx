/** Renders an SVG string produced by lib/qr (our own library output for our own URL). */
export function Qr({ svg, label, className }: { svg: string; label: string; className?: string }) {
  return <div role="img" aria-label={label} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
