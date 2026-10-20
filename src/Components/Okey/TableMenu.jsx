import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { sum } from "lodash";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import * as americano from "./americano";
import * as game from "./game";
import { AMERICANO, ONE_O_ONE } from "./rulesets";
import { t } from "../../i18n";

const PRESETS = [AMERICANO, ONE_O_ONE];

// Every device keeps the latest game it saw, in any room, so it can be
// picked up again after a reset, a closed tab or another night. One is
// enough: a new game replaces it. It's kept as a save code, so the hands
// aren't sitting in plain sight in the browser's storage either.
const SAVE = "okey-save";

function readSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE));
  } catch {
    return null;
  }
}

function useAutoSave() {
  const { okeyState } = useContext(OkeyContext);
  const { roomId } = useParams();
  const timer = useRef();
  useEffect(() => {
    if (okeyState.gameState === "start") return; // nothing to keep yet
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const code = await game.encodeSave(okeyState);
      try {
        localStorage.setItem(
          SAVE,
          JSON.stringify({ room: roomId, at: Date.now(), code }),
        );
      } catch {
        // storage full or blocked: the save code still works
      }
    }, 1000);
  }, [okeyState, roomId]);
}

// a destructive or replacing action takes a second tap within 3s
function Confirm({ label, onConfirm, children }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef();
  return (
    <button
      className={armed ? "armed" : ""}
      onClick={() => {
        clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? t("Sure? Tap again") : label}
      {children}
    </button>
  );
}

function summary(s) {
  const turn = s.players.find((p) => p.id === s.currentPlayer)?.user?.name;
  const scores = s.players
    .filter((p) => p.user)
    .map((p) => `${p.user.name} ${sum(s.scores?.[p.id] ?? [])}`)
    .join(", ");
  return [
    s.rules ? t(`Round ${s.round}/${s.rules.rounds.length}`) : "Okey",
    turn && t(`${turn}'s turn`),
    s.rules && scores,
  ]
    .filter(Boolean)
    .join(" · ");
}

// who sat in each seat then, and who takes it now
function Seats({ saved }) {
  const { okeyState } = useContext(OkeyContext);
  return (
    <ul className="seats">
      {saved.players.map((p) => (
        <li key={p.id}>
          {t(`Player ${p.id}`)}: {p.user?.name ?? "—"} →{" "}
          {okeyState.players.find((x) => x.id === p.id)?.user?.name ??
            t("nobody")}
        </li>
      ))}
    </ul>
  );
}

function Dialog({ title, onClose, children }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <button className="close" aria-label={t("Close")} onClick={onClose}>
          ✕
        </button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function LoadDialog({ onClose }) {
  const { okeyState, loadGame } = useContext(OkeyContext);
  const { roomId } = useParams();
  const [pasted, setPasted] = useState("");
  const load = (saved) => {
    loadGame(game.restore(saved, okeyState));
    onClose();
  };
  // made up front: Safari only copies straight from the tap
  const [code, setCode] = useState("");
  useEffect(() => {
    game.encodeSave(okeyState).then(setCode);
  }, [okeyState]);
  // undefined until read: null is "no save"
  const [saved, setSaved] = useState();
  useEffect(() => {
    const s = readSave();
    if (!s) {
      setSaved(null);
      return;
    }
    game.decodeSave(s.code).then((state) => setSaved(state && { ...s, state }));
  }, []);
  // kept with the text it came from, so typing doesn't flash an error
  const [decoded, setDecoded] = useState({});
  useEffect(() => {
    let live = true;
    game
      .decodeSave(pasted)
      .then((state) => live && setDecoded({ pasted, state }));
    return () => (live = false);
  }, [pasted]);
  const fromCode = decoded.pasted === pasted ? decoded.state : undefined;
  return (
    <Dialog title={t("Saved games")} onClose={onClose}>
      <h4>{t("On this device")}</h4>
      {saved === null && <p>{t("No saved games on this device yet.")}</p>}
      <ul className="saves">
        {[saved].filter(Boolean).map((s) => (
          <li key={s.room}>
            <Confirm label={summary(s.state)} onConfirm={() => load(s.state)}>
              <small>
                {s.room === roomId ? t("this room") : s.room} ·{" "}
                {new Date(s.at).toLocaleString()}
              </small>
            </Confirm>
            <Seats saved={s.state} />
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
          download={`okey-${roomId}.txt`}
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
          <Seats saved={fromCode} />
          <Confirm
            label={t("Load this game")}
            onConfirm={() => load(fromCode)}
          />
        </>
      )}
    </Dialog>
  );
}

// a fresh deal of a ruleset at any round, with each player's total and who
// starts
function SetUpDialog({ onClose }) {
  const { okeyState, loadGame } = useContext(OkeyContext);
  const [id, setId] = useState(okeyState.rules?.id ?? AMERICANO.id);
  const rules = PRESETS.find((r) => r.id === id);
  const seated = okeyState.players.filter((p) => p.user);
  const [picked, setRound] = useState(okeyState.round ?? 1);
  const round = Math.min(picked, rules.rounds.length);
  const [totals, setTotals] = useState(() =>
    Object.fromEntries(
      seated.map((p) => [p.id, sum(okeyState.scores?.[p.id] ?? [])]),
    ),
  );
  const [starter, setStarter] = useState(seated[0]?.id);
  const deal = () => {
    const next = americano.setUp(okeyState, round, totals, starter, rules);
    if (typeof next === "string") return toast(t(next));
    loadGame(next);
    onClose();
  };
  return (
    <Dialog title={t("Set up a game")} onClose={onClose}>
      <label className="round-pick">
        {t("Rules")}{" "}
        <select
          id="setup-rules"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {PRESETS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="round-pick">
        {t("Round")}{" "}
        <select
          id="setup-round"
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
        >
          {rules.rounds.map((r, i) => (
            <option key={r.name} value={i + 1}>
              {/* 101's hands are just numbered */}
              {rules.opening ? i + 1 : `${i + 1}. ${t(r.name)}`}
            </option>
          ))}
        </select>
      </label>
      <table>
        <tbody>
          {seated.map((p) => (
            <tr key={p.id}>
              <th>{p.user.name}</th>
              <td>
                <input
                  id={`setup-total-${p.id}`}
                  type="number"
                  value={totals[p.id]}
                  onChange={(e) =>
                    setTotals({ ...totals, [p.id]: e.target.value })
                  }
                />
              </td>
              <td>
                <label>
                  <input
                    type="radio"
                    name="starter"
                    checked={starter === p.id}
                    onChange={() => setStarter(p.id)}
                  />{" "}
                  {t("starts")}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Confirm label={t("Deal from here")} onConfirm={deal} />
    </Dialog>
  );
}

// Report a problem: Sentry's feedback form (the deployed site only), fetched
// on the first tap. A report carries the game's save code, to load the table
// as it was, and the room and player as tags.
let feedback, form, saveCode;
async function report(okeyState, tags) {
  const { Sentry } = window;
  saveCode = await game.encodeSave(okeyState);
  try {
    feedback ??= new Promise((loaded) => {
      Sentry.onLoad(loaded);
      Sentry.forceLoad();
    }).then(async () => {
      Sentry.addEventProcessor((event, hint) => {
        if (event.type === "feedback") {
          hint.attachments = [
            ...(hint.attachments ?? []),
            { filename: "save-code.txt", data: saveCode },
          ];
        }
        return event;
      });
      const integration = await Sentry.lazyLoadIntegration(
        "feedbackIntegration",
      );
      const it = integration({
        autoInject: false,
        showName: false,
        showEmail: false,
        showBranding: false,
        formTitle: t("Report a problem"),
        messageLabel: t("What happened?"),
        messagePlaceholder: t("What did you see, and what did you expect?"),
        isRequiredLabel: t("(required)"),
        submitButtonLabel: t("Send"),
        cancelButtonLabel: t("Cancel"),
        confirmButtonLabel: t("Done"),
        addScreenshotButtonLabel: t("Add a screenshot"),
        removeScreenshotButtonLabel: t("Remove screenshot"),
        highlightToolText: t("Highlight"),
        hideToolText: t("Hide"),
        removeHighlightText: t("Remove"),
        successMessageText: t("Thanks! Your report is on its way"),
        errorGenericText: t("Couldn't send the report"),
      });
      Sentry.addIntegration(it);
      return it;
    });
    // as Sentry's own attachTo does: one form, dropped once it's sent
    form ??= await (
      await feedback
    ).createForm({
      tags,
      onFormSubmitted: () => {
        form.removeFromDom();
        form = null;
      },
    });
    form.appendToDom();
    form.open();
  } catch {
    // an ad blocker, or no network: try again next tap
    feedback = form = null;
    toast(t("Couldn't open the report form"));
  }
}

// ⋯ in a corner of the table: the moves that end or replace the game live
// here, a tap away instead of in reach of a stray finger
export default function TableMenu() {
  const { okeyState, me, stand, resetGame, newGame, endGame } =
    useContext(OkeyContext);
  const { roomId } = useParams();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  useAutoSave();
  const show = (name) => {
    setOpen(false);
    setDialog(name);
  };
  // the menu folds away once an item has done its job
  const then = (action) => () => {
    setOpen(false);
    action();
  };
  return (
    <div className="table-menu">
      <button
        className="dots"
        aria-label={t("Table menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div className="menu">
          {/* the most needed first; a long menu scrolls on a phone, and
              the moves that end the game sit at the bottom */}
          {window.Sentry && (
            <button
              onClick={then(() =>
                report(okeyState, {
                  room: roomId,
                  player: okeyState.players.find((p) => p.id === me)?.user
                    ?.name,
                }),
              )}
            >
              {t("Report a problem")}
            </button>
          )}
          {me && (
            <Confirm label={t("Stand")} onConfirm={then(() => stand(me))} />
          )}
          {/* mid-round, an empty seat would hold up its turn */}
          {okeyState.gameState !== "play" &&
            okeyState.players
              .filter((p) => p.user && p.id !== me)
              .map((p) => (
                <Confirm
                  key={p.id}
                  label={t(`Free seat: ${p.user.name}`)}
                  onConfirm={then(() => stand(p.id))}
                />
              ))}
          <button onClick={() => show("load")}>{t("Saved games")}</button>
          {(okeyState.gameState === "start" || okeyState.rules) && (
            <button onClick={() => show("setup")}>{t("Set up a game")}</button>
          )}
          {/* classic: the pile ran out, and whoever's turn it is calls it */}
          {!okeyState.rules && game.pileOut(okeyState, me) && (
            <Confirm label={t("End the game")} onConfirm={then(endGame)} />
          )}
          {okeyState.gameState !== "start" && (
            <Confirm label={t("New Game")} onConfirm={then(newGame)} />
          )}
          <Confirm label={t("Reset Game")} onConfirm={then(resetGame)} />
        </div>
      )}
      {dialog === "load" && <LoadDialog onClose={() => setDialog(null)} />}
      {dialog === "setup" && <SetUpDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
