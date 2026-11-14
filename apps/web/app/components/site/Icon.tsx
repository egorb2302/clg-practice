import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  back: <path d="M20 12H5M11 6l-6 6 6 6" />,
  phone: <path d="M6 3l4 1 1 5-2 1a11 11 0 006 6l1-2 5 1 1 4-3 2C10 21 3 14 3 6z" />,
  telegram: <path d="M3 11l18-8-6 18-3-8zM12 13l9-10" />,
  mail: <><path d="M3 6h18v12H3z" /><path d="M3 7l9 6 9-6" /></>,
  bag: <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2" />,
  user: <><path d="M12 4a4 4 0 110 8 4 4 0 010-8z" /><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" /></>,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  chev: <path d="M6 9l6 6 6-6" />,
  trash: <path d="M3 6h18M9 6V3.5h6V6M5.5 6l1.2 14.5h10.6L18.5 6M10 10v7M14 10v7" />,
  shield: <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" />,
  clock: <><path d="M12 3a9 9 0 110 18 9 9 0 010-18z" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z" /><path d="M12 6.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  box: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />,
  ext: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, size, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`ico ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}

export const MARK_OUT ="M18.29 0L0 11L5.23 41.4C9.6 66.84 30.14 84.42 50 94.5C69.86 84.42 90.4 66.84 94.77 41.4L100 11L81.71 0ZM21.04 9.9L10.91 16L14.99 39.72C18.32 59.12 33.26 73.7 50 83.26C66.74 73.7 81.68 59.12 85.01 39.72L89.09 16L78.96 9.9Z";
export const MARK_IN ="M14.91 19.81L25.84 37.35L41.29 44.03L50 79.44L58.71 44.03L74.16 37.35L85.09 19.81L67.41 19.81L50 30.61L32.59 19.81Z";
const WORD = "M665 0H507L457 -166H224L174 0H20L250 -698H438ZM420 -295 377 -440 342 -560H337L303 -440L260 -295ZM994 -256V0H842V-698H1173Q1238 -698 1285.0 -670.0Q1332 -642 1358.0 -592.0Q1384 -542 1384 -475Q1384 -405 1352.5 -351.5Q1321 -298 1257 -274L1394 0H1225L1103 -256ZM994 -384H1154Q1177 -384 1193.0 -392.0Q1209 -400 1218.0 -415.5Q1227 -431 1227 -453V-497Q1227 -520 1218.0 -535.0Q1209 -550 1193.0 -558.0Q1177 -566 1154 -566H994ZM1596 0V-698H1757L1850 -520L1928 -371H1930L2007 -520L2099 -698H2261V0H2118V-350V-458H2115L2064 -356L1928 -109L1795 -355L1742 -465H1739V-350V0ZM2775 12Q2683 12 2613.5 -29.0Q2544 -70 2506.0 -150.5Q2468 -231 2468 -349Q2468 -468 2506.0 -548.0Q2544 -628 2613.5 -669.0Q2683 -710 2775 -710Q2868 -710 2937.0 -669.0Q3006 -628 3044.0 -548.0Q3082 -468 3082 -349Q3082 -231 3044.0 -150.5Q3006 -70 2937.0 -29.0Q2868 12 2775 12ZM2775 -123Q2821 -123 2853.5 -143.5Q2886 -164 2903.5 -203.0Q2921 -242 2921 -297V-401Q2921 -457 2903.5 -495.5Q2886 -534 2853.5 -554.5Q2821 -575 2775 -575Q2730 -575 2697.0 -554.5Q2664 -534 2646.5 -495.5Q2629 -457 2629 -401V-297Q2629 -242 2646.5 -203.0Q2664 -164 2697.0 -143.5Q2730 -123 2775 -123ZM3441 -256V0H3289V-698H3620Q3685 -698 3732.0 -670.0Q3779 -642 3805.0 -592.0Q3831 -542 3831 -475Q3831 -405 3799.5 -351.5Q3768 -298 3704 -274L3841 0H3672L3550 -256ZM3441 -384H3601Q3624 -384 3640.0 -392.0Q3656 -400 3665.0 -415.5Q3674 -431 3674 -453V-497Q3674 -520 3665.0 -535.0Q3656 -550 3640.0 -558.0Q3624 -566 3601 -566H3441ZM4348 0H4016V-121H4106V-577H4016V-698H4348V-577H4258V-121H4348ZM4494 0 4718 -361 4505 -698H4682L4818 -462H4821L4959 -698H5123L4908 -358L5135 0H4959L4808 -257H4805L4658 0Z";

export function VkMark() {
  return <span className="ico ico--vk" aria-hidden="true">VK</span>;
}

export function Logo({ mark = false, className = "" }: { mark?: boolean; className?: string }) {
  if (mark) {
    return (
      <svg className={className} viewBox="0 0 100 94.5" fill="currentColor" aria-hidden="true" focusable="false">
        <path fillRule="evenodd" d={MARK_OUT} />
        <path d={MARK_IN} />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 407.2 94.5" fill="currentColor" role="img" aria-label="ARMORIX" focusable="false">
      <path fillRule="evenodd" d={MARK_OUT} />
      <path d={MARK_IN} />
      <g transform="translate(126 27.4) scale(0.05497) translate(-20 710)"><path d={WORD} /></g>
    </svg>
  );
}
