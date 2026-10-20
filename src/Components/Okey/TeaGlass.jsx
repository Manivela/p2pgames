// An ince belli tea glass on a scalloped red and white saucer, in front of
// whoever's turn it is (Rack.jsx). Drawn in a 100 × 110 box.

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

export default function TeaGlass() {
  return (
    <svg
      className="glass"
      viewBox="0 0 100 110"
      width="40"
      height="44"
      aria-hidden="true"
    >
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
      </defs>
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
    </svg>
  );
}
