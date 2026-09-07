import Link from "next/link";

type LogoProps = {
  compact?: boolean;
};

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 sm:gap-2.5"
      aria-label="O Calçadão — página inicial"
    >
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-ink text-xs font-black text-white shadow-[0_7px_18px_rgba(23,35,33,0.17)] sm:size-10 sm:rounded-[14px] sm:text-sm sm:shadow-[0_8px_20px_rgba(23,35,33,0.18)]">
        <span className="relative z-10">OC</span>
        <span className="absolute -bottom-2 -right-2 size-5.5 rounded-full bg-brand transition-transform duration-300 group-hover:scale-125 sm:size-6" />
      </span>
      {!compact && (
        <span className="text-base font-black tracking-[-0.04em] text-ink sm:text-[1.08rem]">
          O Calçadão
        </span>
      )}
    </Link>
  );
}
