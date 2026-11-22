import { t } from "../i18n";
import { useKeyHints, useVolume } from "../hooks/useStore";
import { useWaitAll } from "../hooks/useRoom";
import { Dialog } from "./Saves";

// Every table's settings (its ⋯ → Settings), by whom they change things
// for: this device's, kept on it for every game, and the room's, everyone's
// in it (hooks/useRoom.js). A table adds its own to each: `device`,
// `everyone`, a setting a line, `<label><span>what</span><input/></label>`.
export default function Settings({ device, everyone, onClose }) {
  const { volume, setVolume } = useVolume();
  const { hints, setHints } = useKeyHints();
  const [wait, setWait] = useWaitAll();
  return (
    <Dialog title={t("Settings")} className="prefs" onClose={onClose}>
      <h4>{t("This device")}</h4>
      <div className="group">
        <label className="volume">
          <span>{t("Sound")}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
        {/* the keycaps on the tables' buttons: on at first on a computer */}
        <label>
          <span>{t("Key hints")}</span>
          <input
            type="checkbox"
            checked={hints}
            onChange={(e) => setHints(e.target.checked)}
          />
        </label>
        {device}
      </div>
      <h4>{t("Everyone here")}</h4>
      <div className="group">
        {/* whose presses start the next round (hooks/useRoom.js) */}
        <label>
          <span>{t("Next round waits for")}</span>
          <select value={wait} onChange={(e) => setWait(e.target.value)}>
            <option value="all">{t("Everyone")}</option>
            <option value="half">{t("Half")}</option>
            <option value="off">{t("No one")}</option>
          </select>
        </label>
        {everyone}
      </div>
    </Dialog>
  );
}
