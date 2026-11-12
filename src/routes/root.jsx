import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Awareness from "../Components/Awareness";
import HowToPlay, { RULES, usePlaying } from "../Components/HowToPlay";
import Menu from "../Components/Menu";
import { t } from "../i18n";

export default function Root() {
  // the menu, from the button in the corner: opened afresh each time
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // the game's How to play, from ? in the corner (the Okey table's is in
  // its ⋯: its corner has room for two)
  const game = useLocation().pathname.split("/")[2];
  const [help, setHelp] = useState(false);
  const playing = usePlaying((s) => s.mode);
  const helps = game in RULES && game !== "okey";
  return (
    <>
      {/* you to the others, and their pointers: open or not, the menu */}
      <Awareness />
      {menuOpen && <Menu onClose={closeMenu} />}
      {/* the corner buttons, on every page: where each table keeps them */}
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
        {helps && (
          <button
            className="help-toggle"
            aria-label={t("How to play")}
            title={t("How to play")}
            onClick={() => setHelp(true)}
          >
            ?
          </button>
        )}
      </div>
      {helps && help && (
        <HowToPlay game={game} mode={playing} onClose={() => setHelp(false)} />
      )}
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
