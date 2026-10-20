import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

export function LogoMark(props: P) {
  return (
    <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true" {...props}>
      <path d="M9 5 L12 21 L5 29 L13 33 L12 37 L24 44 L36 37 L35 33 L43 29 L36 21 L39 5 L29 13 Q24 11.5 19 13 Z" fill="#efe6d2" stroke="#d9a441" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M11.5 11 L14 19 L18 15 Z M36.5 11 L34 19 L30 15 Z" fill="#c8553d" stroke="#c8553d" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M14 24 L20 26 M34 24 L28 26" fill="none" stroke="#1b1714" strokeWidth="3" strokeLinecap="round"/>
      <path d="M20 31 Q24 29.5 28 31 Q27 35 24 37.5 Q21 35 20 31Z" fill="#1b1714" stroke="#1b1714" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M24 37.5 V40 M20.5 40.5 Q24 42.5 27.5 40.5 M10 29 L15 30 M38 29 L33 30" fill="none" stroke="#1b1714" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function Squiggle(props: P) {
  return (
    <svg viewBox="0 0 120 12" width="120" height="12" aria-hidden="true" {...props}>
      <path d="M2 7 C14 1, 22 11, 36 6 S60 2, 72 7 S100 10, 118 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowDoodle(props: P) {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true" {...props}>
      <path d="M6 12 C34 4, 70 8, 92 44" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="300" style={{ ["--len" as string]: 300, animation: "draw 1s var(--ease) both" }} />
      <path d="M78 40 L94 48 L99 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Star(props: P) {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" {...props}>
      <path d="M16 3 L19 12 L29 13 L21 19 L24 29 L16 23 L8 29 L11 19 L3 13 L13 12Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyBoard(props: P) {
  return (
    <svg viewBox="0 0 220 150" width="220" height="150" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 26 L24 90 L92 94 L90 30Z" strokeDasharray="6 5" />
      <path d="M118 52 L120 118 L196 114 L192 48Z" />
      <path d="M130 68 H178 M130 82 H168 M130 96 H176" opacity="0.7" />
      <path d="M96 62 C108 56, 112 72, 118 78" />
      <path d="M112 70 L119 79 L108 82" />
      <path d="M40 46 H74 M40 58 H66" opacity="0.6" />
      <path d="M170 18 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" stroke="#d9a441" />
    </svg>
  );
}

export function EmptyFiles(props: P) {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 22 L10 74 L108 76 L106 30 L58 28 L50 18 L12 16Z" />
      <path d="M32 50 H84" strokeDasharray="4 5" opacity="0.6" />
      <path d="M92 8 q8 -4 14 3" stroke="#d9a441" />
    </svg>
  );
}

export function EmptySearch(props: P) {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M48 12 C70 8, 86 26, 80 46 C74 64, 50 68, 36 56 C22 44, 28 18, 48 12Z" />
      <path d="M72 58 L100 80" strokeWidth="4" />
      <path d="M42 36 q6 -8 14 0 M40 48 q8 6 16 0" opacity="0.7" />
    </svg>
  );
}

export function EmptyTags(props: P) {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 46 L44 14 L100 18 L104 70 L70 80Z" />
      <circle cx="84" cy="34" r="5" />
      <path d="M38 50 L70 48 M40 62 L62 60" opacity="0.6" />
    </svg>
  );
}

export function Sun(props: P) {
  return (
    <svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...props}>
      <circle cx="20" cy="20" r="7" />
      <path d="M20 4v6M20 30v6M4 20h6M30 20h6M9 9l4 4M27 27l4 4M31 9l-4 4M13 27l-4 4" />
    </svg>
  );
}
