import Link from "next/link";

type LogoProps = {
  compact?: boolean;
};

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4"
      aria-label="O Calçadão — página inicial"
    >
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-ink text-sm font-black text-white shadow-[0_8px_20px_rgba(23,35,33,0.18)]">
        <span className="relative z-10">OC</span>
        <span className="absolute -bottom-2 -right-2 size-6 rounded-full bg-brand transition-transform duration-300 group-hover:scale-125" />
      </span>
      {!compact && (
        <span className="text-[1.08rem] font-black tracking-[-0.04em] text-ink">
          O Calçadão
        </span>
      )}
    </Link>
  );
}
