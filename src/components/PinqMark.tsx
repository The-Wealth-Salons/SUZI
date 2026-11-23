/**
 * Founder-approved pinq Heritage Layer logo (icon + wordmark in one raster).
 * Interim 320x120 display derivative of the approved reference crop; replace with the
 * 622x234 lossless original once imported through the approved asset archive.
 * Never redraw or reinterpret this mark. Display at <= 300px wide.
 */
export const PINQ_LOGO_SRC = "/brand/pinq-heritage-reference-preview.webp";

export function PinqLogo({ className = "w-60" }: { className?: string }) {
  return (
    <img
      src={PINQ_LOGO_SRC}
      alt="pinq"
      width={320}
      height={120}
      className={`h-auto max-w-[300px] mix-blend-multiply ${className}`}
    />
  );
}
