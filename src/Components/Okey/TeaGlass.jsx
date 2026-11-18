// An ince belli tea glass on a scalloped red and white saucer, in front of
// whoever's turn it is (Rack.jsx). Drawn in a 100 × 110 box. A tap on it
// pours the next drink: a bottle of Perge (Antalya's beer), a glass of
// rakı, tea again.
import { create } from "zustand";

// the saucer: an ellipse seen from above, its edge in 16 lobes that meet in
// cusps. The glass stands in the middle of the well, the rim curves up from
// it to the edge, and every other lobe is red from the well out into the
// lobe's curve.
const [cx, cy, rx, ry, LIFT] = [50, 91.5, 47, 20.5, 4.5];
const [wx, wy] = [28, 7.5]; // the well
// how far the edge dips between two lobes, the same all round
const dip = (deg) => 2.6 * (1 - Math.abs(Math.cos((deg * 8 * Math.PI) / 180)));
// a point k of the way out to the ellipse, moved in towards the centre, and
// up as far as the rim has risen there
const at = (deg, k, inset = 0) => {
  const a = (deg * Math.PI) / 180;
  const [x, y] = [rx * Math.cos(a), ry * Math.sin(a)];
  const s = k - inset / Math.hypot(x, y);
  const up = LIFT * (Math.max(0, s - 0.45) / 0.55) ** 2;
  return [cx + x * s, cy + y * s - up];
};
const path = (points) =>
  "M" + points.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
const edge = path(
  Array.from({ length: 180 }, (_, i) => at(i * 2, 1, dip(i * 2))),
);
// the middle two thirds of a lobe, from under the well to just inside the edge
const lobe = (mid) => Array.from({ length: 8 }, (_, i) => mid - 7 + i * 2);
const petals = Array.from({ length: 8 }, (_, i) => {
  const arc = lobe(90 + i * 45);
  return path([
    ...arc.map((deg) => at(deg, 1, dip(deg) + 3)),
    ...arc.reverse().map((deg) => at(deg, 0.3)),
  ]);
});
// gold dots between them, halfway from the well to the edge
const dots = Array.from({ length: 8 }, (_, i) => {
  const deg = 112.5 + i * 45;
  const a = (deg * Math.PI) / 180;
  const [x, y] = at(deg, 1, dip(deg));
  return [(x + cx + wx * Math.cos(a)) / 2, (y + cy + wy * Math.sin(a)) / 2];
});

// the glass: a flared rim, the waist a third of the way down, a wide belly
// and a thick base
const GLASS =
  "M24.4 17.3C25.6 24 31.5 32 31.5 41C31.5 50 26.4 62 26.4 74C26.4 82 27 88 31 91.2C34 92.6 40 92.8 50 92.8C60 92.8 66 92.6 69 91.2C73 88 73.6 82 73.6 74C73.6 62 68.5 50 68.5 41C68.5 32 74.4 24 75.6 17.3";

const TEA = (
  <>
    <path d={edge} transform="translate(0 1.8)" fill="#c9c2b4" />
    <path
      d={edge}
      fill="url(#tea-glass-saucer)"
      stroke="rgba(0,0,0,.12)"
      strokeWidth=".6"
    />
    {/* none of it shows through the glass */}
    <g mask="url(#tea-glass-behind)">
      <g
        fill="#d81f30"
        stroke="#d81f30"
        strokeWidth="2.2"
        strokeLinejoin="round"
      >
        {petals.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="#c9a24a">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1" />
        ))}
      </g>
    </g>
    <ellipse
      cx={cx}
      cy={cy}
      rx={wx}
      ry={wy}
      fill="url(#tea-glass-well)"
      stroke="rgba(0,0,0,.18)"
      strokeWidth=".7"
    />
    <ellipse cx="50" cy="92.2" rx="21" ry="2.4" fill="rgba(0,0,0,.14)" />
    <path d={`${GLASS}Z`} fill="url(#tea-glass-glass)" />
    {/* the spoon, its bowl showing through the tea */}
    <path
      d="M31 3C31 .6 37.8-.2 38.4 2.2L45.6 57 42.8 57.4Z"
      fill="url(#tea-glass-spoon)"
      stroke="rgba(0,0,0,.12)"
      strokeWidth=".4"
    />
    <ellipse
      cx="45"
      cy="66.5"
      rx="6"
      ry="10"
      transform="rotate(-8 45 66.5)"
      fill="url(#tea-glass-spoon)"
    />
    <path
      d="M32.6 43.5C32.6 52 27.7 63 27.7 74C27.7 80 28.1 83.5 30.4 84.6C36 85.8 64 85.8 69.6 84.6C71.9 83.5 72.3 80 72.3 74C72.3 63 67.4 52 67.4 43.5Z"
      fill="url(#tea-glass-tea)"
      fillOpacity=".9"
    />
    <ellipse
      cx="50"
      cy="43.5"
      rx="17.4"
      ry="2.4"
      fill="#ef6d7b"
      fillOpacity=".85"
    />
    <path
      d={GLASS}
      fill="none"
      stroke="rgba(235,235,235,.95)"
      strokeWidth="1.1"
    />
    <ellipse
      cx="50"
      cy="17.3"
      rx="25.6"
      ry="3.3"
      fill="rgba(255,255,255,.06)"
      stroke="rgba(235,235,235,.95)"
      strokeWidth="1.1"
    />
    <path
      d="M66.5 48C69 56 70.2 66 70 80M29.6 24C31.4 28 33 33 33.4 38"
      stroke="rgba(255,255,255,.55)"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
    {/* steam */}
    <path
      d="M60 13C57 9 62 6 59 1M65 14C62.5 10.5 66.5 8 64 4"
      stroke="rgba(255,255,255,.3)"
      strokeWidth="1.1"
      strokeLinecap="round"
      fill="none"
    />
  </>
);

// Perge Premium: an amber bottle, a gold cap, its name in white on a black
// label in a gold oval under ears of wheat, a crest on the neck. The others
// stand on the felt.
const BOTTLE =
  "M43.8 8V24C43.8 33 35 35 35 44V103A15 2.6 0 0 0 65 103V44C65 35 56.2 33 56.2 24V8Z";
const PERGE = (
  <>
    <ellipse cx="50" cy="105.6" rx="17" ry="2.2" fill="rgba(0,0,0,.18)" />
    <path d={BOTTLE} fill="url(#tea-glass-bottle)" />
    <path
      d="M43.8 11A6.2 1.1 0 0 0 56.2 11V23A6.2 1.1 0 0 1 43.8 23Z"
      fill="#1d1a17"
    />
    <circle cx="50" cy="17.5" r="2.2" fill="#c9a24a" />
    <circle cx="50" cy="17.5" r="1.1" fill="#b3202a" />
    <path d="M35 62A15 2.6 0 0 0 65 62V99A15 2.6 0 0 1 35 99Z" fill="#1d1a17" />
    <g fill="none" stroke="#c9a24a" strokeWidth=".6">
      <path d="M35 62A15 2.6 0 0 0 65 62M35 99A15 2.6 0 0 0 65 99" />
      <ellipse cx="50" cy="80" rx="11.5" ry="14" />
      <path d="M42 87.5H58" />
    </g>
    <g fill="#c9a24a">
      {[45.5, 47.75, 50, 52.25, 54.5].map((x) => (
        <ellipse key={x} cx={x} cy="72" rx=".7" ry="2" />
      ))}
    </g>
    <text
      x="50"
      y="83.5"
      fill="#fff"
      fontFamily="Georgia, serif"
      fontSize="8.5"
      fontWeight="700"
      textAnchor="middle"
      textLength="21"
      lengthAdjust="spacingAndGlyphs"
    >
      Perge
    </text>
    <path d={BOTTLE} fill="url(#tea-glass-shade)" />
    <path
      d="M39.2 46V100M45.6 9V24"
      stroke="rgba(255,255,255,.35)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* the cap, crimped */}
    <path
      d="M42.6 8.3L42.3 3.4Q50 1.9 57.7 3.4L57.4 8.3Z"
      fill="url(#tea-glass-cap)"
    />
    <path
      d="M45 3.6V8.1M47.5 3.3V8.1M50 3.2V8.1M52.5 3.3V8.1M55 3.6V8.1"
      stroke="rgba(0,0,0,.25)"
      strokeWidth=".4"
    />
  </>
);

// a rakı glass (Paşabahçe's Heybeli): tall, its sides curving in a little to
// a waist near halfway, then out into a heavy, rounded base
const RAKI =
  "M33 22C33.6 36 35.5 48 35.5 62C35.5 78 33.6 88 33.6 99C33.6 104 37 106 50 106C63 106 66.4 104 66.4 99C66.4 88 64.5 78 64.5 62C64.5 48 66.4 36 67 22";
const RAKI_GLASS = (
  <>
    <ellipse cx="50" cy="106" rx="16" ry="2.2" fill="rgba(0,0,0,.18)" />
    <path d={`${RAKI}Z`} fill="url(#tea-glass-raki-glass)" />
    {/* with water it clouds over, a bluish white */}
    <path
      d="M36.1 46C36.5 52 36.8 56 36.8 62C36.8 77 35.3 86 35.1 93C35.1 96 40 97 50 97C60 97 64.9 96 64.9 93C64.7 86 63.2 77 63.2 62C63.2 56 63.5 52 63.9 46Z"
      fill="url(#tea-glass-raki)"
      fillOpacity=".8"
    />
    <ellipse cx="50" cy="46" rx="13.9" ry="1.8" fill="#f2f7f9" />
    <g
      fill="#fff"
      fillOpacity=".35"
      stroke="#fff"
      strokeOpacity=".8"
      strokeWidth=".6"
    >
      <rect
        x="41"
        y="41.5"
        width="8.5"
        height="7.5"
        rx="1.5"
        transform="rotate(-12 45.25 45.25)"
      />
      <rect
        x="51"
        y="43.5"
        width="7.5"
        height="6.5"
        rx="1.5"
        transform="rotate(14 54.75 46.75)"
      />
    </g>
    <path
      d={RAKI}
      fill="none"
      stroke="rgba(235,235,235,.95)"
      strokeWidth="1.1"
    />
    <ellipse
      cx="50"
      cy="22"
      rx="17"
      ry="2.2"
      fill="rgba(255,255,255,.06)"
      stroke="rgba(235,235,235,.95)"
      strokeWidth="1.1"
    />
    <path
      d="M35 28C35.5 38 36.8 48 37.2 58M36.4 72C35.4 82 34.9 88 34.9 95"
      stroke="rgba(255,255,255,.55)"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
  </>
);

const DRINKS = [TEA, PERGE, RAKI_GLASS];

// the same drink at every seat the glass passes to, tea again on reload
// ponytail: this tab only; for everyone at the table it needs a Yjs key of
// its own (CLAUDE.md), as anyone can tap at any time
const usePoured = create(() => ({ n: 0 }));

// One at every seat while a round is on (Rack.jsx), shown at whoever's turn
// it is: a glass made at the next seat and taken down at the last, its 80
// elements laid out anew, held up the frame of every discard by half
export default function TeaGlass({ idle }) {
  const n = usePoured((s) => s.n);
  const pour = () => usePoured.setState({ n: (n + 1) % DRINKS.length });
  return (
    <svg
      className={idle ? "glass idle" : "glass"}
      viewBox="0 0 100 110"
      width="40"
      height="44"
      aria-hidden="true"
      onClick={pour}
    >
      {DRINKS[n]}
    </svg>
  );
}

// the glasses' gradients and mask, once on the table (Board.jsx): an idle
// glass's own would be hidden with it, and a mask whose content is hidden
// hides what it masks in the glass that shows
export function GlassDefs() {
  return (
    <svg className="glass-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <linearGradient id="tea-glass-tea" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8475a" />
          <stop offset=".55" stopColor="#cc1428" />
          <stop offset="1" stopColor="#a80c1c" />
        </linearGradient>
        <linearGradient
          id="tea-glass-glass"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="17"
          x2="0"
          y2="93"
        >
          <stop offset="0" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".86" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".89" stopColor="#fff" stopOpacity=".78" />
          <stop offset="1" stopColor="#fff" stopOpacity=".92" />
        </linearGradient>
        <linearGradient id="tea-glass-saucer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#e4e1da" />
        </linearGradient>
        <linearGradient id="tea-glass-well" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6d0c4" />
          <stop offset="1" stopColor="#f8f6f1" />
        </linearGradient>
        <mask id="tea-glass-behind">
          <rect width="100" height="110" fill="#fff" />
          <path d={GLASS} fill="#000" />
        </mask>
        <linearGradient id="tea-glass-spoon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#b7bec6" />
        </linearGradient>
        <linearGradient id="tea-glass-bottle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a2f04" />
          <stop offset=".3" stopColor="#c98510" />
          <stop offset=".42" stopColor="#f0b23c" />
          <stop offset=".7" stopColor="#a8650a" />
          <stop offset="1" stopColor="#4e2803" />
        </linearGradient>
        <linearGradient id="tea-glass-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a1c" />
          <stop offset=".35" stopColor="#f1d27a" />
          <stop offset=".6" stopColor="#b8902e" />
          <stop offset="1" stopColor="#6e5212" />
        </linearGradient>
        <linearGradient id="tea-glass-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopOpacity=".3" />
          <stop offset=".25" stopOpacity="0" />
          <stop offset=".7" stopOpacity="0" />
          <stop offset="1" stopOpacity=".35" />
        </linearGradient>
        <linearGradient
          id="tea-glass-raki-glass"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="22"
          x2="0"
          y2="106"
        >
          <stop offset="0" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".88" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".91" stopColor="#fff" stopOpacity=".78" />
          <stop offset="1" stopColor="#fff" stopOpacity=".92" />
        </linearGradient>
        <linearGradient id="tea-glass-raki" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f4f8fa" />
          <stop offset=".55" stopColor="#d9e3e8" />
          <stop offset="1" stopColor="#b5c4cc" />
        </linearGradient>
      </defs>
    </svg>
  );
}
