import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { t } from "../i18n";
import { Confirm } from "./Confirm";
import { encodeSave } from "./saveCode";
import "./saves.css";

// Every device keeps the latest two games of each kind it saw (`name`:
// okey, backgammon…), in any room, so they can be picked up again after a
// reset, a closed tab or another night: each as it last was, a third game
// pushing out the oldest. They're kept as save codes (saveCode.js), so the
// hands aren't sitting in plain sight in the browser's storage either.
const SAVES = 2;
const key = (name) => `${name}-save`;

function readSaves(name) {
  try {
    // a single save, as Okey kept before
    return [JSON.parse(localStorage.getItem(key(name))) ?? []].flat();
  } catch {
    return [];
  }
}

// `state` kept a second after it last changes, as the game `id`; none
// (null) while there's nothing to keep yet
export function useAutoSave(name, state, id) {
  const { roomId } = useParams();
  const timer = useRef();
  useEffect(() => {
    if (!state) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const code = await encodeSave(state);
      const saves = [
        { room: roomId, at: Date.now(), game: id, code },
        ...readSaves(name).filter((s) => s.game !== id),
      ].slice(0, SAVES);
      try {
        localStorage.setItem(key(name), JSON.stringify(saves));
      } catch {
        // storage full or blocked: the save code still works
      }
    }, 1000);
  }, [state, roomId]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function Dialog({ title, className = "", onClose, children }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className={`dialog ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label={t("Close")} onClick={onClose}>
          ✕
        </button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// who sat in each seat then, and who takes it now
function Seats({ seats }) {
  return (
    <ul className="seats">
      {seats.map(([seat, then, now]) => (
        <li key={seat}>
          {seat}: {then ?? "—"} → {now ?? t("nobody")}
        </li>
      ))}
    </ul>
  );
}

// The games of `name` kept on this device (useAutoSave), and the one in
// play, `state`, as a code to copy or download for another device, where
// it's pasted. `decode(code)`: the game of this kind in a code, or null;
// `summary(saved)`: a line about it; `seats(saved)`: [seat, who sat there
// then, who sits there now] each; `load(saved)`: plays it at the table.
export function SavedGames({
  name,
  state,
  decode,
  summary,
  seats,
  load,
  onClose,
}) {
  const { roomId } = useParams();
  const [pasted, setPasted] = useState("");
  const pick = (saved) => {
    load(saved);
    onClose();
  };
  // made up front: Safari only copies straight from the tap
  const [code, setCode] = useState("");
  useEffect(() => {
    encodeSave(state).then(setCode);
  }, [state]);
  // undefined until read
  const [saved, setSaved] = useState();
  useEffect(() => {
    Promise.all(
      readSaves(name).map((s) =>
        decode(s.code).then((state) => state && { ...s, state }),
      ),
    ).then((saves) => setSaved(saves.filter(Boolean)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // kept with the text it came from, so typing doesn't flash an error
  const [decoded, setDecoded] = useState({});
  useEffect(() => {
    let live = true;
    decode(pasted).then((state) => live && setDecoded({ pasted, state }));
    return () => (live = false);
  }, [pasted]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromCode = decoded.pasted === pasted ? decoded.state : undefined;
  return (
    <Dialog title={t("Saved games")} onClose={onClose}>
      <h4>{t("On this device")}</h4>
      {saved?.length === 0 && <p>{t("No saved games on this device yet.")}</p>}
      <ul className="saves">
        {saved?.map((s) => (
          <li key={s.at}>
            <Confirm label={summary(s.state)} onConfirm={() => pick(s.state)}>
              <small>
                {s.room === roomId ? t("this room") : s.room} ·{" "}
                {new Date(s.at).toLocaleString()}
              </small>
            </Confirm>
            <Seats seats={seats(s.state)} />
          </li>
        ))}
      </ul>
      <h4>{t("From another device")}</h4>
      <p>
        <button
          onClick={() =>
            navigator.clipboard
              ?.writeText(code)
              .then(() => toast(t("Copied")))
              .catch(() => toast(t("Couldn't copy")))
          }
        >
          {t("Copy this game's code")}
        </button>{" "}
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(code)}`}
          download={`${name}-${roomId}.txt`}
        >
          {t("Download")}
        </a>
      </p>
      <textarea
        rows={2}
        placeholder={t("Paste a save code")}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
      />
      {pasted && fromCode === null && <p>{t("That's not a save code")}</p>}
      {fromCode && (
        <>
          <p>{summary(fromCode)}</p>
          <Seats seats={seats(fromCode)} />
          <Confirm
            label={t("Load this game")}
            onConfirm={() => pick(fromCode)}
          />
        </>
      )}
    </Dialog>
  );
}
