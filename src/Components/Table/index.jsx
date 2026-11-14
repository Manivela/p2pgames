import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import useSound from "use-sound";
import { toast } from "react-hot-toast";
import { useAwareness, useDoc, useMap, useWebRtc } from "../../vendor/y-react";
import {
  useAuthStore,
  useFacing,
  useKeyHints,
  useVolume,
} from "../../hooks/useStore";
import { MOD, useEscape, useKey } from "../../hooks/useKey";
import { signalingServers, peerOpts } from "../../constants";
import { Confirm } from "../Confirm";
import { usePlaying } from "../HowToPlay";
import { PLAYS } from "../Menu";
import { SavedGames, useAutoSave } from "../Saves";
import { useRecord } from "../Stats/store";
import { decodeSave } from "../saveCode";
import { t } from "../../i18n";
import tok from "./assets/tok.mp3";
import "./table.css";

// A table for two in the room, for a game played in turns (Backgammon, Go,
// TicTacToe): its own Yjs map, `name`, with `seat-0` and `seat-1`, who
// plays each side, each written by whoever sits or stands, and `game`, the
// rules' state, written by the player to move, or by its hosts for a
// new game. Only one player moves at a time, so one key holds the whole
// game. A game's state has `turn`, the seat to move, `winner` ({ seat })
// once one's won, and `score`, carried over by `newGame(prev, ids, mode)`
// while the same two sit. `sides`: what the seats are called, white and
// black. The way it's played, `mode` in the map (`first` till one's
// picked), is picked in the site's menu (Menu.jsx), or Go's board size in
// its ⋯ (`setMode`), by those seated while no game is in play (`idle`), or
// by anyone while nobody sits: before a player's first move (`touched`),
// it deals again; once a game's over, the next one.
// `bot`: the game's, { play(state, seat): its move, the next state;
// wait(state): ms before it, 900 when not given }. Each game dealt has an
// `id`, as it's kept on the device (Saves.jsx).
export function useTable(name, newGame, sides, first, bot) {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers, peerOpts });
  const { states, localID } = useAwareness(provider.awareness);
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
  // no game in play: none yet, one over, or one no player has moved in yet
  // (a bot may have: a mode picked deals again)
  const idle = !game || game.turn === null || !!game.winner || !game.touched;
  // who deals and picks the mode: the players, or with a bot in each seat,
  // anyone watching them
  const bots = seats.every((u) => u?.bot);
  const hosts = seated || bots;
  const ids = seats.map((u) => u?.id ?? null);

  const sit = (i) => map.set(`seat-${i}`, currentUser);
  const mode = map.get("mode") ?? first;
  const deal = (m = mode) =>
    map.set("game", {
      ...newGame(game, ids, m),
      id: Math.random().toString(36).slice(2),
    });
  // with nobody seated, a game left on the board goes with it
  const empty = !seats.some(Boolean);
  const canMode = (hosts && idle) || empty;
  const setMode = (m) => {
    map.set("mode", m);
    if (full && idle) deal(m);
    else if (empty && game) map.set("game", null);
  };

  // the first game starts once both seats are taken, from whichever host's
  // page sees it first (two at once: one game wins, the same for everyone)
  useEffect(() => {
    if (!game && full && hosts) deal();
  });

  // A bot sits in an empty seat, either or both, and plays its turns
  // through the same rules, played by the page that seated it (`runner`),
  // or while that one's gone, the room's first page; anyone not seated can
  // take its seat. sessionStorage botPace: ms before each move.
  const addBot = (i) =>
    map.set(`seat-${i}`, {
      id: `bot-${i}`,
      name: "Bot",
      bot: true,
      runner: localID,
    });
  const up = game && !game.winner && game.turn !== null && seats[game.turn];
  const runner =
    up?.bot && (states.has(up.runner) ? up.runner : Math.min(...states.keys()));
  const plays = runner === localID;
  useEffect(() => {
    if (!plays) return;
    let pace = null;
    try {
      pace = sessionStorage.getItem("botPace");
    } catch {
      // blocked: its own pace
    }
    const timer = setTimeout(
      () => {
        // as it is now: a score reset since doesn't come back
        const now = map.get("game");
        if (now.turn !== null && !now.winner && seats[now.turn]?.bot) {
          const next = bot.play(now, now.turn);
          if (next) map.set("game", next);
        }
      },
      Number(pace ?? bot.wait?.(game) ?? 900),
    );
    return () => clearTimeout(timer);
  }, [plays, game?.id, game?.last.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // the game kept on this device once a move's been made in it, so a deal
  // nobody's played yet doesn't push out the last one kept; a kept one
  // played again at today's table (⋯ → Saved games, by its hosts, or
  // anyone's while nobody sits), each seat going to whoever sits in it now
  // and the table's mode to its (the game's own, Go's the table's)
  const kept = useMemo(
    () => game && { table: name, game, seats, mode: game.mode ?? mode },
    [game, seats[0], seats[1], mode], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useAutoSave(name, game?.last.kind !== "new" && kept, game?.id);
  // every game played here recorded on the device, for the stats, with
  // who sits in each seat as it goes
  useRecord(
    game?.id,
    game && {
      ...game,
      seats: seats.map((u) => u && { id: u.id, name: u.name, bot: !!u.bot }),
    },
    {
      kind: name,
      mode: game?.mode ?? mode,
      me: currentUser.id,
      seated,
      over: !!game && (!!game.winner || game.turn === null),
    },
  );
  const play = (s) =>
    PLAYS.find((p) => p.game === name && p.mode === s.mode) ??
    PLAYS.find((p) => p.game === name);
  // who sat there, or as at the table (`named`), its side
  const sat = (s, i) =>
    (s.seats[0]?.id !== s.seats[1]?.id && s.seats[i]?.name) || t(sides[i]);
  const saves = {
    name,
    state: kept,
    decode: async (code) => {
      const s = await decodeSave(code);
      return s?.table === name && s.game ? s : null;
    },
    summary: (s) =>
      [
        [play(s).name, play(s).kind].filter(Boolean).join(" "),
        s.game.winner
          ? t(`${sat(s, s.game.winner.seat)} wins!`)
          : s.game.turn !== null && t(`${sat(s, s.game.turn)}'s turn`),
        [0, 1].map((i) => `${sat(s, i)} ${s.game.score[i]}`).join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
    seats: (s) =>
      [0, 1].map((i) => [t(sides[i]), s.seats[i]?.name, seats[i]?.name]),
    load: (s) =>
      map.doc.transact(() => {
        map.set("mode", s.mode);
        map.set("game", { ...s.game, players: ids });
      }),
  };

  // the mode in play, the game's own (backgammon's says none: the first),
  // or before a game the one picked: How to play's (root.jsx) and the menu's
  const playing = game ? (game.mode ?? first) : mode;
  // the room goes to another game (the menu) at its players' word between
  // games, or at anyone's while none of them is here: a player gone (a
  // closed tab) keeps the seat, and the game, for their return
  const here = new Set([...states.values()].map((s) => s?.user?.id));
  const playersHere = seats.some((u) => u && !u.bot && here.has(u.id));
  const why =
    !playersHere || (seated && idle)
      ? null
      : seated
        ? "A game is in play: finish it, or start a new one in ⋯"
        : "Only the players can change the game";
  useEffect(() => usePlaying.setState({ mode: playing, why }), [playing, why]);
  // a mode picked in the menu for this table: its players' between games,
  // or anyone's while nobody sits; a game of players gone stays theirs
  const pick = usePlaying((s) => s.pick);
  useEffect(() => {
    if (pick?.game !== name) return;
    usePlaying.setState({ pick: null });
    if (pick.mode === playing) return;
    if (canMode) setMode(pick.mode);
    else if (!playersHere) tell("Its players are away: free their seats in ⋯");
    else tell(why ?? "Only the players can change the game");
  }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const named = (s) => (!both && !bots && seats[s]?.name) || t(sides[s]);
  return {
    map,
    sides,
    seats,
    game,
    mine,
    seated,
    hosts,
    bots,
    both,
    full,
    near,
    far: 1 - near,
    // the two on this device sit face to face (Table's ⋯ menu): what's
    // one's to read is turned to them (`.over`)
    across: both && facing,
    facing,
    setFacing,
    here,
    names: [0, 1].map(named),
    // the room's here: a game, or a seat taken waiting for one
    live: !!game || seats.some(Boolean),
    note: game
      ? null
      : seats.some(Boolean)
        ? t("Waiting for a second player")
        : t("Sit down to play"),
    // a player's move (a bot's is written by the bot's driver, above)
    act: (next) => next && map.set("game", { ...next, touched: true }),
    sit,
    // a bot for an empty seat
    addBot: (i) => bot && !seats[i] && (() => addBot(i)),
    stand: () => mine.forEach((i) => map.set(`seat-${i}`, null)),
    free: (i) => map.set(`seat-${i}`, null),
    // the next game, for the hosts of a full table
    deal: hosts && full ? () => deal() : null,
    mode,
    setMode: canMode ? setMode : null,
    saves: hosts || empty ? saves : null,
  };
}

// A seat: the side's piece (`mark`), who sits there, or Sit while it's
// free (and 🤖, a bot: `bot`), a number by the name (`info`: { value,
// title }), and the games they've won (`points`), on their own plate, so
// there's no telling whose is whose. A bot's, to someone not seated, has
// the Sit that takes it over in place of the number.
function Plate({
  mark,
  name,
  user,
  turn,
  here,
  info,
  points,
  sit,
  bot,
  over,
  empty,
}) {
  return (
    <div className={`tb-plate${turn ? " turn" : ""}${over ? " over" : ""}`}>
      <span className="tb-mark">{mark}</span>
      {user && <span className="name">{name}</span>}
      {sit ? (
        <button className="tb-sit" onClick={sit}>
          {t("Sit")}
        </button>
      ) : (
        !user && <span className="name empty">{empty}</span>
      )}
      {bot && (
        <button
          className="tb-bot"
          aria-label={t("Add a bot")}
          title={t("Add a bot")}
          onClick={bot}
        >
          🤖
        </button>
      )}
      {user && !here && <small className="away">{t("away")}</small>}
      {info && !sit && <small title={info.title}>{info.value}</small>}
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
  saves,
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  // the menu folds away once an item has done its job
  const then = (action) => () => {
    setOpen(false);
    action();
  };
  useEscape(open && (() => setOpen(false)));
  const { hints, setHints } = useKeyHints();
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
              {/* the keycaps on Undo, the dice, the bowl and the next
                  game's tap, as at the Okey table (useKeyHints) */}
              <label className="hints">
                {t("Key hints")}
                <input
                  type="checkbox"
                  checked={hints}
                  onChange={(e) => setHints(e.target.checked)}
                />
              </label>
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
            <div className="group">
              {saves && (
                <button onClick={then(() => setSaved(true))}>
                  {t("Saved games")}
                </button>
              )}
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
      {saved && saves && (
        <SavedGames {...saves} onClose={() => setSaved(false)} />
      )}
    </div>
  );
}

// The table (useTable): the players and their scores beside the board, the
// ⋯ menu in the corner, and the board, `children`, as big as the room
// left fits. `mark(seat)`: the side's piece; `info(seat)`: a number by
// its name; `options`: the game's own settings, in the menu.
export function Table({ table, mark, info, options, children }) {
  const { seats, game, mine, seated, both, full, near, far, across } = table;
  const { volume, setVolume } = useVolume();
  const { hints } = useKeyHints();
  const score = game?.score ?? [0, 0];
  const plate = (s) => (
    <Plate
      mark={mark(s)}
      // a bot's plate says so; the sides name two in what's said
      name={seats[s]?.bot ? seats[s].name : table.names[s]}
      user={seats[s]}
      // whose turn it is, or who's won
      turn={game && (game.winner?.seat ?? game.turn) === s}
      here={seats[s]?.bot || table.here.has(seats[s]?.id)}
      // a seat nobody's in has no pips or prisoners to speak of
      info={seats[s] && info?.(s)}
      points={score[s]}
      sit={!seated && (!seats[s] || seats[s].bot) ? () => table.sit(s) : null}
      bot={table.addBot(s)}
      over={across && s === far}
      empty={t(table.sides[s])}
    />
  );
  return (
    <div className={hints ? "tb-fit" : "tb-fit no-keys"}>
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
              name: table.names[i],
              go: () => table.free(i),
            }))}
          newGame={table.deal}
          saves={table.saves}
          resetScore={
            table.hosts &&
            game?.score.some(Boolean) &&
            (() => table.act({ ...game, score: [0, 0] }))
          }
        />
      </div>
      <div className="tb-wrap">{children}</div>
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
// different, never the one just heard, at this device's sound level
export function useTok() {
  const { volume } = useVolume();
  const [play] = useSound(tok, { volume: 0.5 * volume, sprite: TOKS });
  const last = useRef(0);
  return () => {
    last.current = (last.current + 1 + Math.floor(Math.random() * 4)) % 5;
    play({ id: String(last.current) });
  };
}

// takes back the last move: a round button, an arrow turning back, placed
// and sized by the game (`className`, `style`); or ⌘Z, Ctrl+Z
export function Undo({ className, style, onClick }) {
  useKey("mod+z", onClick);
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
      <kbd>{MOD}Z</kbd>
    </button>
  );
}

// why a move can't be made, a toast turned to the one who tried it when
// they sit `away` across the board (the toasts are the site's, outside it)
export const tell = (why, away) =>
  toast(t(why), { id: "why", style: away ? { rotate: "180deg" } : {} });
