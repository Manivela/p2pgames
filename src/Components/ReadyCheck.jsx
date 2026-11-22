import { t } from "../i18n";
import Layer from "./Layer";
import "./ReadyCheck.css";

// A ready check (useReadyCheck, hooks/useRoom.js), open: a plate on the
// table's middle (Layer), with a big Ready that pulses till you've pressed
// it, and by it the others it still waits for, `name(key)`.
export default function ReadyCheck({ check, name }) {
  if (!check.open) return null;
  const waiting = check.waiting.map(name).filter(Boolean);
  return (
    <Layer>
      <div className="ready-plate">
        {check.press ? (
          <button aria-pressed={check.pressed} onClick={check.press}>
            {t("Ready")}
          </button>
        ) : (
          <p className="ready-title">{t("Ready check")}</p>
        )}
        {waiting.length > 0 && (
          <p className="ready-waiting">{waiting.join(" · ")}</p>
        )}
      </div>
    </Layer>
  );
}
