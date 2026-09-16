import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function LocateIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z" />
      <path d="M9.2 8.2c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.6.7c-.2.2-.1.4 0 .6.7 1.2 1.6 2 2.8 2.6.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.7.8c.3.1.4.3.4.5 0 .3-.2 1.4-.8 1.9-.5.5-1.3.8-2.2.6-1-.2-2.3-.6-3.9-1.9-1.2-1-2.2-2.2-2.8-3.6-.7-1.5-.1-2.7.3-3.2l.8-1.1Z" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6.6 3.8 9 3l2 5-2.1 1.3a15 15 0 0 0 5.8 5.8L16 13l5 2-0.8 2.4a4 4 0 0 1-4.5 2.7A15.5 15.5 0 0 1 3.9 8.3 4 4 0 0 1 6.6 3.8Z" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M14 21v-8h3l.5-4H14V7.5c0-1.2.7-2 2.2-2H18V2.2c-.7-.1-1.7-.2-2.8-.2C11.8 2 9.5 4.1 9.5 7.8V9H6v4h3.5v8H14Z" />
    </svg>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 10v10h16V10" />
      <path d="M3 10h18l-2-6H5l-2 6Z" />
      <path d="M8 20v-6h8v6M7 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m12 3 1.2 3.3L16.5 8l-3.3 1.2L12 12.5l-1.2-3.3L7.5 8l3.3-1.7L12 3Z" />
      <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14ZM5 12l.7 1.8 1.8.7-1.8.7L5 17l-.7-1.8-1.8-.7 1.8-.7L5 12Z" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 13 13 20l-9-9V4h7l9 9Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13.5 6.5 17.5 10.5M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17.5v.1" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 15-5-5L5 20" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </svg>
  );
}
