import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import useSound from "use-sound";
import { toast } from "react-hot-toast";
import { useAwareness, useDoc, useMap, useWebRtc } from "../../vendor/y-react";
import { useAuthStore, useFacing, useVolume } from "../../hooks/useStore";
import { signalingServers, peerOpts } from "../../constants";
import { Confirm } from "../Confirm";
import { t } from "../../i18n";
import tok from "./assets/tok.mp3";
import "./table.css";

// A table for two in the room, for a game played in turns (Backgammon, Go,
// TicTacToe): its own Yjs map, `name`, with `seat-0` and `seat-1`, who
// plays each side, each written by whoever sits or stands, and `game`, the
// rules' state, written by the player to move, or by anyone seated for a
// new game. Only one player moves at a time, so one key holds the whole
// game. A game's state has `turn`, the seat to move, `winner` ({ seat })
// once one's won, and `score`, carried over by `newGame(prev, ids, mode)`
// while the same two sit. `sides`: what the seats are called, white and
// black. `modes`: the ways the game can be played, { label, list: [{ id,
// name }] }, the first the default; the table's, `mode` in the map, chosen
// by those seated on the board while no game is in play (Modes): before
// the first move, it deals again; once a game's over, the next one.
export function useTable(name, newGame, sides, modes) {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers, peerOpts });
  const { states } = useAwareness(provider.awareness);
  const currentUser = useAuthStore((s) => s.currentUser);
  useMap(name); // re-render on every change
  const map = useDoc().getMap(name);
  // each seat its own key, so two sitting down at once both stay
  const seats = [map.get("seat-0") ?? null, map.get("seat-1") ?? null];
  const game = map.get("game") ?? null;
  const { facing, setFacing } = useFacing();

  // the seats this page plays: one, or both on one device, taking turns
  const mine = [0, 1].filter((i) => seats[i]?.id === currentUser.id);
  const seated = mine.length > 0;
  const both = mine.length === 2;
  // the board as your seat sees it, the first seat's for someone watching
  // or playing both
  const near = both ? 0 : (mine[0] ?? 0);
  const full = seats.every(Boolean);
  const ids = seats.map((u) => u?.id ?? null);

  const sit = (i) => map.set(`seat-${i}`, currentUser);
  const mode = map.get("mode") ?? modes?.list[0].id;
  const deal = (m = mode) => map.set("game", newGame(game, ids, m));
  const setMode = (m) => {
    map.set("mode", m);
    const fresh = !game || game.last.kind === "new" || game.turn === null;
    if (full && fresh) deal(m);
  };

  // the first game starts once both seats are taken, from whichever seated
  // page sees it first (two at once: one game wins, the same for everyone)
  useEffect(() => {
    if (!game && full && seated) deal();
  });

  // a new name (the sidebar) goes on your seats
  useEffect(() => {
    for (const i of mine) {
      if (seats[i].name !== currentUser.name) {
        map.set(`seat-${i}`, { ...seats[i], name: currentUser.name });
      }
    }
  });

  // development: read and write the game (window.backgammon, window.go…)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window[name] = {
      ...window[name],
      get: () => map.get("game"),
      set: (g) => map.set("game", g),
    };
  }, [map, name]);

  // one name on both seats says nothing: the sides, then
  const named = (s) => (!both && seats[s]?.name) || t(sides[s]);
  return {
    map,
    sides,
    seats,
    game,
    mine,
    seated,
    both,
    full,
    near,
    far: 1 - near,
    // the two on this device sit face to face (Table's ⋯ menu): what's
    // one's to read is turned to them (`.over`)
    across: both && facing,
    facing,
    setFacing,
    here: new Set([...states.values()].map((s) => s?.user?.id)),
    names: [0, 1].map(named),
    // the room's here: a game, or a seat taken waiting for one
    live: !!game || seats.some(Boolean),
    note: game
      ? null
      : seats.some(Boolean)
        ? t("Waiting for a second player")
        : t("Sit down to play"),
    act: (next) => next && map.set("game", next),
    sit,
    stand: () => mine.forEach((i) => map.set(`seat-${i}`, null)),
    free: (i) => map.set(`seat-${i}`, null),
    // the next game, for those seated at a full table
    deal: seated && full ? () => deal() : null,
    modes,
    mode,
    setMode: seated && modes ? setMode : null,
  };
}

// A seat: the side's piece (`mark`), who sits there, or Sit while it's
// free, a number by the name (`info`: { value, title }), and the games
// they've won (`points`), on their own plate, so there's no telling whose
// is whose
function Plate({
  mark,
  name,
  user,
  turn,
  here,
  info,
  points,
  sit,
  over,
  empty,
}) {
  return (
    <div className={`tb-plate${turn ? " turn" : ""}${over ? " over" : ""}`}>
      <span className="tb-mark">{mark}</span>
      {user ? (
        <span className="name">{name}</span>
      ) : sit ? (
        <button className="tb-sit" onClick={sit}>
          {t("Sit")}
        </button>
      ) : (
        <span className="name empty">{empty}</span>
      )}
      {user && !here && <small className="away">{t("away")}</small>}
      {info && <small title={info.title}>{info.value}</small>}
      <b className="tb-points" title={t("Score")}>
        {points}
      </b>
    </div>
  );
}

// in groups, a line between them, as at the Okey table (TableMenu.jsx):
// this device, your seat, the others', and in red the moves that end or
// replace the game
function Menu({
  volume,
  setVolume,
  options,
  facing,
  setFacing,
  stand,
  playBoth,
  free,
  newGame,
  resetScore,
}) {
  const [open, setOpen] = useState(false);
  // the menu folds away once an item has done its job
  const then = (action) => () => {
    setOpen(false);
    action();
  };
  return (
    <div className="tb-menu">
      <button
        className="dots"
        aria-label={t("Table menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="backdrop" onClick={() => setOpen(false)} />
          <div className="menu">
            <div className="group">
              <label className="volume">
                {t("Sound")}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
              {options}
              {setFacing && (
                <label className="facing">
                  {t("Face to face")}
                  <input
                    type="checkbox"
                    checked={facing}
                    onChange={(e) => setFacing(e.target.checked)}
                  />
                </label>
              )}
            </div>
            <div className="group">
              {/* the empty seat too, taking turns on this device */}
              {playBoth && (
                <button onClick={then(playBoth)}>{t("Play both sides")}</button>
              )}
              {stand && <button onClick={then(stand)}>{t("Stand")}</button>}
            </div>
            {/* anyone frees a seat someone left without standing (a closed
                tab, another browser): the game waits in it */}
            <div className="group">
              {free.map(({ seat, name, go }) => (
                <Confirm
                  key={seat}
                  label={t(`Free seat: ${name}`)}
                  onConfirm={then(go)}
                />
              ))}
            </div>
            <div className="group ends">
              {newGame && (
                <Confirm label={t("New Game")} onConfirm={then(newGame)} />
              )}
              {resetScore && (
                <Confirm
                  label={t("Reset score")}
                  onConfirm={then(resetScore)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// The table (useTable): the players and their scores beside the board, the
// ⋯ menu in the corner, and the board, `children`, as big as the room
// left fits. `mark(seat)`: the side's piece; `info(seat)`: a number by
// its name; `options`: the game's own, for this device, in the menu.
export function Table({ table, mark, info, options, children }) {
  const { seats, game, mine, seated, both, full, near, far, across } = table;
  const { volume, setVolume } = useVolume();
  const score = game?.score ?? [0, 0];
  const plate = (s) => (
    <Plate
      mark={mark(s)}
      name={table.names[s]}
      user={seats[s]}
      // whose turn it is, or who's won
      turn={game && (game.winner?.seat ?? game.turn) === s}
      here={table.here.has(seats[s]?.id)}
      info={info?.(s)}
      points={score[s]}
      sit={!seated && !seats[s] ? () => table.sit(s) : null}
      over={across && s === far}
      empty={t(table.sides[s])}
    />
  );
  return (
    <div className="tb-fit">
      <div className="tb-head">
        {plate(far)}
        {plate(near)}
        <Menu
          volume={volume}
          setVolume={setVolume}
          options={options}
          facing={table.facing}
          setFacing={both && table.setFacing}
          stand={seated && table.stand}
          playBoth={seated && !full && (() => table.sit(1 - mine[0]))}
          free={[0, 1]
            .filter((i) => seats[i] && !mine.includes(i))
            .map((i) => ({
              seat: i,
              name: seats[i].name,
              go: () => table.free(i),
            }))}
          newGame={table.deal}
          resetScore={
            seated &&
            game?.score.some(Boolean) &&
            (() => table.act({ ...game, score: [0, 0] }))
          }
        />
      </div>
      <div className="tb-wrap">{children}</div>
    </div>
  );
}

// How the game's played, picked on the board while none is in play: before
// anyone's moved, or once it's over (useTable's `modes`)
export function Modes({ table }) {
  const { modes, mode, setMode, game } = table;
  const idle = !game || game.last.kind === "new" || game.turn === null;
  if (!setMode || !idle) return null;
  return (
    <div className="tb-modes" role="group" aria-label={t(modes.label)}>
      {modes.list.map(({ id, name }) => (
        <button
          key={id}
          aria-pressed={id === mode}
          onClick={() => id !== mode && setMode(id)}
        >
          {t(name)}
        </button>
      ))}
    </div>
  );
}

// When `value` last changed in a live game this page was already showing:
// 0 when it came with the game. Pieces move and sound only for a play seen
// happen, not when the game arrives, the board turns to the viewer's side
// as they sit, or the screen resizes.
export function useChangedAt(value, live) {
  const seen = useRef(null);
  const s = seen.current;
  if (!live) seen.current = null;
  else if (!s) seen.current = { value, at: 0 };
  else if (s.value !== value) seen.current = { value, at: Date.now() };
  return seen.current?.at ?? 0;
}

// Each play seen, `last` ({ n, kind… }), heard: `hear(last)`, not the one
// the page first sees, whether it opened on it or it came over the network
// after. A new sound level is heard as it's set: `sample()`.
export function useHeard(last, hear, sample) {
  const { volume } = useVolume();
  const heard = useRef(last?.n);
  const ear = useRef(hear);
  ear.current = hear;
  useEffect(() => {
    if (!last || last.n === heard.current) return;
    const first = heard.current === undefined;
    heard.current = last.n;
    if (!first) ear.current(last);
  }, [last]);
  const level = useRef(volume);
  const tryIt = useRef(sample);
  tryIt.current = sample;
  useEffect(() => {
    if (level.current === volume) return;
    level.current = volume;
    tryIt.current();
  }, [volume]);
}

// five checkers set down on a wooden board (Kenney's Impact Sounds, CC0):
// where each starts in tok.mp3, and how long it lasts, in ms
const TOKS = {
  0: [0, 262],
  1: [400, 262],
  2: [800, 262],
  3: [1200, 262],
  4: [1600, 262],
};

// a piece set down on wood, a checker or a stone, each a little
// different, at this device's sound level
export function useTok() {
  const { volume } = useVolume();
  const [play] = useSound(tok, { volume: 0.5 * volume, sprite: TOKS });
  return () => play({ id: String(Math.floor(Math.random() * 5)) });
}

// takes back the last move: a round button, an arrow turning back, placed
// and sized by the game (`className`, `style`)
export function Undo({ className, style, onClick }) {
  return (
    <button
      className={`tb-undo ${className}`}
      style={style}
      aria-label={t("Undo")}
      title={t("Undo")}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
      </svg>
    </button>
  );
}

// why a move can't be made, a toast turned to the one who tried it when
// they sit `away` across the board (the toasts are the site's, outside it)
export const tell = (why, away) =>
  toast(t(why), { id: "why", style: away ? { rotate: "180deg" } : {} });
