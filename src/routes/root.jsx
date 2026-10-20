import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toast } from "react-hot-toast";
import Awareness from "../Components/Awareness";
import Credits from "../Components/Credits";
import coffee from "../assets/coffee.svg";
import { t } from "../i18n";

// wide screens show the sidebar beside the game, small ones lay it over it
// (index.css)
const docked = () => matchMedia("(min-width: 1025px)").matches;

export default function Root() {
  // closed to start; the button hides and shows it on any screen
  const [menuOpen, setMenuOpen] = useState(false);
  // fullscreen is just the game (the button brings the sidebar back);
  // leaving it, with the button or Esc, puts the sidebar back as it was
  const wasOpen = useRef(false);
  useEffect(() => {
    const onChange = () =>
      setMenuOpen((open) => {
        if (!document.fullscreenElement) return wasOpen.current;
        wasOpen.current = open;
        return false;
      });
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return (
    <>
      <div id="sidebar" className={menuOpen ? "open" : ""}>
        <nav onClick={() => !docked() && setMenuOpen(false)}>
          <ul>
            <li>
              <NavLink
                to="tictactoe"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                TicTacToe
              </NavLink>
            </li>
            {/* <li>
              <NavLink
                to="chat"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Chat
              </NavLink>
            </li> */}
            <li>
              <NavLink
                to="backgammon"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Backgammon
              </NavLink>
            </li>
            <li>
              <NavLink
                to="minecraft"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Minecraft
              </NavLink>
            </li>
            <li>
              <NavLink
                to="okey"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Okey
              </NavLink>
            </li>
            <li>
              <NavLink
                to="go"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Go
              </NavLink>
            </li>
          </ul>
        </nav>
        <button
          onClick={() =>
            navigator.clipboard
              ?.writeText(window.location.href)
              .then(() => toast.success(t("Copied!")))
              .catch(() => toast(t("Couldn't copy")))
          }
        >
          {t("Share Link")}
        </button>
        <div>
          <a
            className="bmc-btn"
            href="https://buymeacoffee.com/manivela"
            target="_blank"
            rel="noreferrer"
          >
            <img src={coffee} alt="" />
            Buy me a coffee
          </a>
        </div>
        <Credits />
        <Awareness />
      </div>
      {/* top left on every page, beside the sidebar while it's open */}
      <div className="corner">
        <button
          className="menu-toggle"
          aria-label={t("Menu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        {/* iPhone Safari has no fullscreen for pages, so no button there */}
        {document.fullscreenEnabled && (
          <button
            className="fullscreen-toggle"
            aria-label={t("Fullscreen")}
            title={t("Fullscreen")}
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
            }
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
          </button>
        )}
      </div>
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
