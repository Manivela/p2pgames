import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { uniqBy } from "lodash";
import { useAwareness, useDoc, useMap, useWebRtc } from "../vendor/y-react";
import { useAuthStore } from "../hooks/useStore";
import { signalingServers, peerOpts } from "../constants";
import Credits from "./Credits";
import { usePlaying } from "./HowToPlay";
import coffee from "../assets/coffee.svg";
import { t } from "../i18n";
import "./menu.css";

// Each way to play a game the room can (root.jsx): the game, the room's
// `game`, and the mode its table plays (Table's useTable, Okey's preset;
// none, Go: the game as its table has it);
// its name (Okey and Go as they are: t() would make Go the login's "Gir"),
// a kind of it under the name, and its icon, the game's own material:
// grid paper, the walnut case, a tile on the felt, the kaya board
const paper = (
  <>
    <rect width="40" height="40" fill="#fdfaf2" />
    <path
      d="M0 10h40M0 20h40M0 30h40M10 0v40M20 0v40M30 0v40"
      stroke="#cfdcf3"
    />
  </>
);
const x = (at, size, width) => (
  <path
    d={`M${at[0]} ${at[1]}l${size} ${size}M${at[0] + size} ${at[1]}l${-size} ${size}`}
    stroke="#2747a0"
    strokeWidth={width}
    strokeLinecap="round"
  />
);
const o = (at, r, width) => (
  <circle
    cx={at[0]}
    cy={at[1]}
    r={r}
    fill="none"
    stroke="#c62828"
    strokeWidth={width}
  />
);
const white = (cx, cy) => (
  <circle cx={cx} cy={cy} r="4.5" fill="#f6efe0" stroke="#bba882" />
);
const black = (cx, cy) => (
  <circle cx={cx} cy={cy} r="4.5" fill="#2a2a2a" stroke="#000" />
);
const tile = (
  <>
    <rect width="40" height="40" fill="#2a6a1f" />
    <rect x="11" y="9" width="18" height="25" rx="3" fill="#cbb68a" />
    <rect x="11" y="6" width="18" height="25" rx="3" fill="#fbf6e8" />
    <text
      x="20"
      y="25"
      textAnchor="middle"
      fontSize="16"
      fontWeight="800"
      fill="#c62828"
    >
      7
    </text>
  </>
);
export const PLAYS = [
  {
    game: "tictactoe",
    mode: "classic",
    name: t("Tic-tac-toe"),
    kind: t("Classic"),
    icon: (
      <>
        {paper}
        {x([8, 8], 10, 3)}
        {o([27, 27], 6, 3)}
      </>
    ),
  },
  {
    game: "tictactoe",
    mode: "super",
    name: t("Tic-tac-toe"),
    kind: t("Super"),
    icon: (
      <>
        {paper}
        <path
          d="M14 3v34M26 3v34M3 14h34M3 26h34"
          stroke="#333"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {x([5, 5], 5, 1.8)}
        {o([20, 20], 3, 1.8)}
        {x([29, 29], 5, 1.8)}
        {o([32, 8], 3, 1.8)}
      </>
    ),
  },
  {
    game: "backgammon",
    mode: "tavla",
    name: t("Backgammon"),
    icon: (
      <>
        <rect width="40" height="40" fill="#4a2c17" />
        <rect x="4" y="4" width="32" height="32" rx="2" fill="#ead9c0" />
        <path d="M4 4l6 20 6-20zM24 4l6 20 6-20z" fill="#2b1a10" />
        <path d="M14 4l6 20 6-20z" fill="#8e4f28" />
        <circle cx="13" cy="29" r="5.5" fill="#f6efe0" stroke="#bba882" />
        <circle cx="26" cy="29" r="5.5" fill="#2a2a2a" stroke="#000" />
      </>
    ),
  },
  {
    game: "backgammon",
    mode: "checkers",
    name: t("Checkers"),
    icon: (
      <>
        <rect width="40" height="40" fill="#ead9c0" />
        <path
          d="M10 0h10v10H10zM30 0h10v10H30zM0 10h10v10H0zM20 10h10v10H20zM10 20h10v10H10zM30 20h10v10H30zM0 30h10v10H0zM20 30h10v10H20z"
          fill="#5a3820"
        />
        {black(25, 15)}
        {white(15, 25)}
      </>
    ),
  },
  {
    game: "backgammon",
    mode: "dama",
    name: t("Dama"),
    icon: (
      <>
        <rect width="40" height="40" fill="#e2c48f" />
        <path
          d="M10 0v40M20 0v40M30 0v40M0 10h40M0 20h40M0 30h40"
          stroke="#8a6436"
        />
        {black(15, 15)}
        {black(25, 15)}
        {white(15, 25)}
        {white(25, 25)}
      </>
    ),
  },
  ...[
    ["americano", t("Americano")],
    ["classic", t("Classic")],
    ["101", "101"],
  ].map(([mode, kind]) => ({
    game: "okey",
    mode,
    name: "Okey",
    kind,
    icon: tile,
  })),
  // its board's size picked at the table (its ⋯): the rules are the same
  {
    game: "go",
    name: "Go",
    icon: (
      <>
        <rect width="40" height="40" fill="#dcb06b" />
        <path
          d="M8 0v40M20 0v40M32 0v40M0 8h40M0 20h40M0 32h40"
          stroke="#7a5626"
        />
        <circle cx="20" cy="20" r="7" fill="#1c1c1c" />
        <circle cx="18" cy="18" r="2" fill="#555" />
        <circle cx="32" cy="32" r="7" fill="#f7f5ee" stroke="#bbb" />
      </>
    ),
  },
];

// The room's game, the same for everyone in it, in the room's Yjs map
// `room`: Okey till one's picked, and for someone joining, till the
// room's comes over the network
export const useRoomGame = () => {
  useMap("room"); // re-render on every change
  const room = useDoc().getMap("room");
  const game = room.get("game");
  return [
    PLAYS.some((p) => p.game === game) ? game : "okey",
    (g) => room.set("game", g),
  ];
};

const share = () =>
  navigator.clipboard
    ?.writeText(window.location.href)
    .then(() => toast.success(t("Copied!")))
    .catch(() => toast(t("Couldn't copy")));

// who's in the room, once each (a player's tabs are one player), you
// first. Your name is changed where it is: ✎ or a tap on it, then Enter or
// a tap away keeps it, Esc leaves it as it was, and so does an empty one.
// The new name goes on your seat (OkeyContext, Table).
function Here() {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers, peerOpts });
  const { states } = useAwareness(provider.awareness);
  const me = useAuthStore((s) => s.currentUser);
  const rename = useAuthStore((s) => s.rename);
  const [editing, setEditing] = useState(false);
  const mine = (u) => u.id === me.id;
  const here = uniqBy(
    [...states.values()].map((s) => s?.user).filter(Boolean),
    "id",
  ).sort((a, b) => mine(b) - mine(a));
  return (
    <ul className="here">
      {here.map((u) => (
        <li
          key={u.id}
          className={mine(u) ? "me" : undefined}
          onClick={() => mine(u) && setEditing(true)}
        >
          <span className="dot" style={{ background: u.color }}>
            {u.name?.[0]?.toUpperCase()}
          </span>
          {mine(u) && editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = e.target.username.value.trim();
                if (name && name !== me.name) rename(name);
                setEditing(false);
              }}
            >
              <input
                name="username"
                aria-label={t("Your name")}
                defaultValue={me.name}
                autoFocus
                onFocus={(e) => e.target.select()}
                onBlur={(e) => e.target.form.requestSubmit()}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.stopPropagation(); // the menu stays open
                  e.target.value = me.name;
                  e.target.blur();
                }}
              />
            </form>
          ) : (
            <>
              {u.name}
              {mine(u) && (
                <>
                  <small>({t("you")})</small>
                  <button className="rename" aria-label={t("Change your name")}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                    >
                      <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                    </svg>
                  </button>
                </>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// The site's menu, from ☰ in the corner: a card over the game, as the
// table's ⋯ opens from the other corner. A search over the games, and
// beside it the room's code, a tap on it copying the invite; every way to
// play each game in a grid that scrolls once there are more than fit (from
// the one being played); then who's here. A tap outside, Esc or a pick
// closes it. A pick takes the room there, everyone in it, as its table's
// players can between games (Table's useTable, Okey's MenuPicks), and says
// why not when it can't. Opened afresh each time (root.jsx): its search
// empty, your name not being changed.
export default function Menu({ onClose }) {
  const { roomId } = useParams();
  const [q, setQ] = useState("");
  const plays = PLAYS.filter((p) =>
    `${p.name} ${p.kind ?? ""}`
      .toLocaleLowerCase()
      .includes(q.trim().toLocaleLowerCase()),
  );
  const [game, setGame] = useRoomGame();
  const mode = usePlaying((s) => s.mode);
  const at = (p) => p.game === game && (!p.mode || p.mode === mode);
  const pick = (p) => {
    onClose();
    if (at(p)) return;
    if (p.game !== game) {
      const { why } = usePlaying.getState();
      if (why) return toast(t(why), { id: "why" });
      setGame(p.game);
    }
    if (p.mode) usePlaying.setState({ pick: { game: p.game, mode: p.mode } });
  };
  const list = useRef();
  useEffect(() => {
    list.current.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }, []);
  // the coffee and the credits go once the card runs out of room (a phone
  // on its side, a room full of people), so it scrolls only when nothing
  // else can go: checked as the screen, the people or the games change
  const card = useRef();
  const foot = useRef();
  useEffect(() => {
    const fit = () => {
      foot.current.style.display = "";
      const over = card.current.scrollHeight > card.current.clientHeight;
      foot.current.style.display = over ? "none" : "";
    };
    const seen = new ResizeObserver(fit);
    seen.observe(document.documentElement);
    seen.observe(list.current);
    seen.observe(card.current.querySelector(".here"));
    return () => seen.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="site-menu-backdrop" onClick={onClose} />
      <div className="site-menu" ref={card}>
        <div className="top">
          <input
            className="find"
            type="search"
            placeholder={t("Find a game")}
            aria-label={t("Find a game")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="invite"
            onClick={share}
            aria-label={t("Copy invite link")}
            title={t("Copy invite link")}
          >
            <b>{roomId}</b>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M15 5H6a1 1 0 0 0-1 1v9" />
            </svg>
          </button>
        </div>
        <nav className="games" ref={list}>
          {plays.map((p) => (
            <button
              key={`${p.game} ${p.mode}`}
              className={at(p) ? "active" : undefined}
              onClick={() => pick(p)}
            >
              <svg className="game-icon" viewBox="0 0 40 40" aria-hidden="true">
                {p.icon}
              </svg>
              {p.name} {p.kind && <small>{p.kind}</small>}
            </button>
          ))}
        </nav>
        {!plays.length && <p className="none">{t("No game by that name")}</p>}
        <aside>
          <Here />
          <footer ref={foot}>
            <a
              className="bmc-btn"
              href="https://buymeacoffee.com/manivela"
              target="_blank"
              rel="noreferrer"
            >
              <img src={coffee} alt="" />
              Buy me a coffee
            </a>
            <Credits game={game} />
          </footer>
        </aside>
      </div>
    </>
  );
}
