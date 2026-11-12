import { useEffect, useRef, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { uniqBy } from "lodash";
import { useAwareness, useWebRtc } from "../vendor/y-react";
import { useAuthStore } from "../hooks/useStore";
import { signalingServers, peerOpts } from "../constants";
import Credits from "./Credits";
import coffee from "../assets/coffee.svg";
import { t } from "../i18n";
import "./menu.css";

// The games, each its route (main.jsx), its name (Okey and Go as they
// are: t() would make Go the login's "Gir") and its icon, the game's own
// material: grid paper, the walnut case, a tile on the felt, the kaya board
const GAMES = [
  {
    path: "tictactoe",
    name: t("Tic-tac-toe"),
    icon: (
      <>
        <rect width="40" height="40" fill="#fdfaf2" />
        <path
          d="M0 10h40M0 20h40M0 30h40M10 0v40M20 0v40M30 0v40"
          stroke="#cfdcf3"
        />
        <path
          d="M8 8l10 10M18 8 8 18"
          stroke="#2747a0"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx="27"
          cy="27"
          r="6"
          fill="none"
          stroke="#c62828"
          strokeWidth="3"
        />
      </>
    ),
  },
  {
    path: "backgammon",
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
    path: "okey",
    name: "Okey",
    icon: (
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
    ),
  },
  {
    path: "go",
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
// table's ⋯ opens from the other corner. The games, found by name, in a
// grid that scrolls once there are more than fit (from the one you're
// at); then the room: its invite link and who's here. A tap outside, Esc
// or a game picked closes it. Opened afresh each time (root.jsx): its
// search empty, your name not being changed.
export default function Menu({ onClose }) {
  const { roomId } = useParams();
  const [q, setQ] = useState("");
  const games = GAMES.filter((g) =>
    g.name.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()),
  );
  const list = useRef();
  useEffect(() => {
    list.current.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="site-menu-backdrop" onClick={onClose} />
      <div className="site-menu">
        <input
          className="find"
          type="search"
          placeholder={t("Find a game")}
          aria-label={t("Find a game")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <nav className="games" ref={list} onClick={onClose}>
          {games.map((g) => (
            <NavLink key={g.path} to={g.path}>
              <svg className="game-icon" viewBox="0 0 40 40" aria-hidden="true">
                {g.icon}
              </svg>
              {g.name}
            </NavLink>
          ))}
        </nav>
        {!games.length && <p className="none">{t("No game by that name")}</p>}
        <aside>
          <div className="room">
            <span>
              {t("Room")} <b>{roomId}</b>
            </span>
            <button className="invite" onClick={share}>
              {t("Copy invite link")}
            </button>
          </div>
          <Here />
          <footer>
            <a
              className="bmc-btn"
              href="https://buymeacoffee.com/manivela"
              target="_blank"
              rel="noreferrer"
            >
              <img src={coffee} alt="" />
              Buy me a coffee
            </a>
            <Credits />
          </footer>
        </aside>
      </div>
    </>
  );
}
