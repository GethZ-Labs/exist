/*
  The EXiST ribbon loop, redrawn as a single stroke so it can
  "draw itself" (stroke-dashoffset) and inherit currentColor.
*/

export const LOOP_PATH =
  "M70 625 C170 745 280 778 385 778 C540 778 700 700 820 615 C960 515 1030 420 1025 320 C1020 200 940 110 850 110 C750 110 630 200 628 330 C625 450 720 545 820 615 C930 690 1080 775 1215 775 C1330 775 1440 720 1525 625";

export function LoopMark({
  className = "",
  draw = false,
  strokeWidth = 128,
}: {
  className?: string;
  draw?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={`loop-mark ${draw ? "loop-mark-draw" : ""} ${className}`}
      viewBox="0 0 1600 900"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={LOOP_PATH}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      EX<span className="wordmark-i">ı</span>ST
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo ${className}`} aria-label="EXiST">
      <LoopMark className="logo-loop" />
      <Wordmark className="logo-word" />
    </span>
  );
}
