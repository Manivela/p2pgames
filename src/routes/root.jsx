import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toast } from "react-hot-toast";
import Awareness from "../Components/Awareness";
import Credits from "../Components/Credits";
import { t } from "../i18n";

export default function Root() {
  // small screens hide the sidebar; this button lays it over the game
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <button
        className="menu-toggle"
        aria-label={t("Menu")}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        ☰
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
      <div id="sidebar" className={menuOpen ? "open" : ""}>
        <nav onClick={() => setMenuOpen(false)}>
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
        <div style={{ flexGrow: 1 }} />
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success(t("Copied!"));
          }}
        >
          {t("Share Link")}
        </button>
        <Credits />
        <Awareness />
      </div>
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
