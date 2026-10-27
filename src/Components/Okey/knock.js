// A knock on the table (two quick taps on the felt, Board.jsx), heard by
// everyone at once (OkeyContext), from where it was: left or right of them,
// as they sit.

// How far right of `me` (-1 left … 1 right) a knock is, made by seat `by`
// at (x, y) on their screen (x to their right, y away from them, each -1 …
// 1). Seats go round the table in the order `players` lists them, the next
// one on your right (Board.jsx); someone watching sees it as the first seat.
export function panOf({ x, y, by }, players, me) {
  const ids = players.map((p) => p.id);
  const at = (id) => Math.max(0, ids.indexOf(id));
  const turn = ((at(by) - at(me) + ids.length) % ids.length) / ids.length;
  const a = turn * 2 * Math.PI;
  return Math.max(-1, Math.min(1, x * Math.cos(a) - y * Math.sin(a)));
}

// browsers let a page make sound only after a tap or a key: the first one
// readies it, so a knock from someone else can be heard (no page in tests)
let audio;
for (const type of ["pointerdown", "keydown"]) {
  globalThis.addEventListener?.(
    type,
    () => (audio ??= new AudioContext()).resume(),
    {
      once: true,
      capture: true,
    },
  );
}

// a knuckle on wood, twice: a short click over a low thud
export function playKnock(pan, volume) {
  if (import.meta.env.DEV)
    window.okeyKnocks = [...(window.okeyKnocks ?? []), pan];
  if (!volume) return;
  audio ??= new AudioContext();
  audio.resume();
  const out = new StereoPannerNode(audio, { pan });
  out.connect(audio.destination);
  const { sampleRate } = audio;
  const noise = new AudioBuffer({ length: sampleRate * 0.03, sampleRate });
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  for (const delay of [0, 0.15]) {
    const t = audio.currentTime + delay;
    // a sound that comes in sharp and dies away over `length` seconds
    const fade = (peak, length) => {
      const gain = new GainNode(audio);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak * volume, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      gain.connect(out);
      return gain;
    };
    const thud = new OscillatorNode(audio);
    thud.frequency.setValueAtTime(180, t);
    thud.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    thud.connect(fade(0.9, 0.14));
    thud.start(t);
    thud.stop(t + 0.15);
    const click = new AudioBufferSourceNode(audio, { buffer: noise });
    click
      .connect(
        new BiquadFilterNode(audio, { type: "bandpass", frequency: 1500 }),
      )
      .connect(fade(0.5, 0.03));
    click.start(t);
  }
}
