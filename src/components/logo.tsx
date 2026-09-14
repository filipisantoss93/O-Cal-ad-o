import Image from "next/image";
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
      <span className="relative size-9 shrink-0 overflow-hidden rounded-[13px] shadow-[0_7px_18px_rgba(23,35,33,0.2)] transition-transform duration-300 group-hover:scale-[1.03] sm:size-10 sm:rounded-[14px] sm:shadow-[0_8px_20px_rgba(23,35,33,0.22)]">
        <Image
          src="/pwa-192.png"
          alt=""
          width={192}
          height={192}
          sizes="40px"
          unoptimized
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {!compact && (
        <span className="text-base font-black tracking-[-0.04em] text-ink sm:text-[1.08rem]">
          O Calçadão
        </span>
      )}
    </Link>
  );
}
