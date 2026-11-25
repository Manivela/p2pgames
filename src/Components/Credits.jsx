import { t } from "../i18n";

// where the sounds of the room's `game` (Menu.jsx) come from
function Credits({ game }) {
  if (game === "backgammon") {
    return (
      <div style={{ flexDirection: "column" }}>
        {t("Sound Effects from")}{" "}
        <a href="https://opengameart.org/content/2-dice-roll-29-throws">
          OpenGameArt
        </a>{" "}
        &amp; <a href="https://kenney.nl/assets/impact-sounds">Kenney</a>
      </div>
    );
  }
  // the stones: backgammon's wooden toks
  if (["go", "gomoku", "fourinarow"].includes(game)) {
    return (
      <div style={{ flexDirection: "column" }}>
        {t("Sound Effects from")}{" "}
        <a href="https://kenney.nl/assets/impact-sounds">Kenney</a>
      </div>
    );
  }
  // the cards: put down, slid, shuffled
  if (game === "batak") {
    return (
      <div style={{ flexDirection: "column" }}>
        {t("Sound Effects from")}{" "}
        <a href="https://kenney.nl/assets/casino-audio">Kenney</a>
      </div>
    );
  }
  if (game === "okey") {
    return (
      <div style={{ flexDirection: "column" }}>
        {t("Sound Effects from")}{" "}
        <a href="https://pixabay.com/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=102855">
          Pixabay
        </a>
      </div>
    );
  }
  return null;
}

export default Credits;
