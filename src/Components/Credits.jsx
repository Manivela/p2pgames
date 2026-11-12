import { useMatch } from "react-router-dom";
import { t } from "../i18n";

function Credits() {
  const isMinecraft = useMatch("/:roomId/minecraft");
  const isBackgammon = useMatch("/:roomId/backgammon");
  const isOkey = useMatch("/:roomId/okey");
  const isGo = useMatch("/:roomId/go");
  if (isBackgammon) {
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
  if (isGo) {
    return (
      <div style={{ flexDirection: "column" }}>
        {t("Sound Effects from")}{" "}
        <a href="https://kenney.nl/assets/impact-sounds">Kenney</a>
      </div>
    );
  }
  if (isOkey) {
    return (
      <div style={{ flexDirection: "column" }}>
        {t("Sound Effects from")}{" "}
        <a href="https://pixabay.com/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=102855">
          Pixabay
        </a>
      </div>
    );
  }
  if (isMinecraft) {
    return (
      <div style={{ flexDirection: "column" }}>
        <div>Credits for this example:</div>
        <a
          href="https://www.youtube.com/watch?v=ZnXKmODEFHA&t=1s"
          target="_blank"
          rel="noreferrer"
        >
          Youtube: @CodingTech
        </a>
        <a
          href="https://github.com/danba340/minecraft-react"
          target="_blank"
          rel="noreferrer"
        >
          GitHub: danba340
        </a>
      </div>
    );
  }
  return null;
}

export default Credits;
