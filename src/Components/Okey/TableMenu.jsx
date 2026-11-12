import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { sum, uniqBy } from "lodash";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import * as okey from "./okey";
import { allRulesets } from "./rulesets";
import { TableSettings } from "./GameSettings";
import { t } from "../../i18n";
import { Confirm } from "../Confirm";
import HowToPlay, { okeyKind } from "../HowToPlay";

export { Confirm };

// Every device keeps the latest two games it saw, in any room, so they can
// be picked up again after a reset, a closed tab or another night: each as
// it last was, a third game pushing out the oldest. They're kept as save
// codes, so the hands aren't sitting in plain sight in the browser's
// storage either.
const SAVE = "okey-save";
const SAVES = 2;

function readSaves() {
  try {
    // a single save, as kept before
    return [JSON.parse(localStorage.getItem(SAVE)) ?? []].flat();
  } catch {
    return [];
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
      const code = await okey.encodeSave(okeyState);
      const { gameId } = okeyState;
      const saves = [
        { room: roomId, at: Date.now(), game: gameId, code },
        ...readSaves().filter((s) => s.game !== gameId),
      ].slice(0, SAVES);
      try {
        localStorage.setItem(SAVE, JSON.stringify(saves));
      } catch {
        // storage full or blocked: the save code still works
      }
    }, 1000);
  }, [okeyState, roomId]);
}

function summary(s) {
  const turn = s.players.find((p) => p.id === s.currentPlayer)?.user?.name;
  const scores = s.players
    .filter((p) => p.user)
    .map((p) => `${p.user.name} ${sum(s.scores?.[p.id] ?? [])}`)
    .join(", ");
  return [
    s.rules.rounds.length > 1
      ? `${s.rules.name} · ${t(`Round ${s.round}/${s.rules.rounds.length}`)}`
      : s.rules.name,
    turn && t(`${turn}'s turn`),
    scores,
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

function LoadDialog({ onClose }) {
  const { okeyState, loadGame } = useContext(OkeyContext);
  const { roomId } = useParams();
  const [pasted, setPasted] = useState("");
  const load = (saved) => {
    loadGame(okey.restore(saved, okeyState));
    onClose();
  };
  // made up front: Safari only copies straight from the tap
  const [code, setCode] = useState("");
  useEffect(() => {
    okey.encodeSave(okeyState).then(setCode);
  }, [okeyState]);
  // undefined until read
  const [saved, setSaved] = useState();
  useEffect(() => {
    Promise.all(
      readSaves().map((s) =>
        okey.decodeSave(s.code).then((state) => state && { ...s, state }),
      ),
    ).then((saves) => setSaved(saves.filter(Boolean)));
  }, []);
  // kept with the text it came from, so typing doesn't flash an error
  const [decoded, setDecoded] = useState({});
  useEffect(() => {
    let live = true;
    okey
      .decodeSave(pasted)
      .then((state) => live && setDecoded({ pasted, state }));
    return () => (live = false);
  }, [pasted]);
  const fromCode = decoded.pasted === pasted ? decoded.state : undefined;
  return (
    <Dialog title={t("Saved games")} onClose={onClose}>
      <h4>{t("On this device")}</h4>
      {saved?.length === 0 && <p>{t("No saved games on this device yet.")}</p>}
      <ul className="saves">
        {saved?.map((s) => (
          <li key={s.at}>
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
  // the game's own rules and the lobby's first, over a preset of their id
  const list = uniqBy(
    [okeyState.rules, okeyState.setup, ...allRulesets()].filter(Boolean),
    "id",
  );
  const [id, setId] = useState(list[0].id);
  const rules = list.find((r) => r.id === id);
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
    const next = okey.setUp(okeyState, round, totals, starter, rules);
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
          {list.map((r) => (
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
            <option key={i} value={i + 1}>
              {`${i + 1}. ${t(r.name)}`}
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
  saveCode = await okey.encodeSave(okeyState);
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
  const {
    okeyState,
    me,
    stand,
    sit,
    seatBot,
    freeSeat,
    resetGame,
    newGame,
    redealRound,
    act,
    volume,
    setVolume,
    newVersion,
  } = useContext(OkeyContext);
  const { roomId } = useParams();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  useAutoSave();
  const playing = okeyState.gameState === "play";
  const free = okey.freeSeats(okeyState);
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
      {/* a newer version out (OkeyContext): a dot on ⋯, easy to leave be */}
      <button
        className={newVersion ? "dots news" : "dots"}
        aria-label={t("Table menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        // in groups, a line between them (an empty one takes none): this
        // device, your seat, the others', the game's tools, and the moves
        // that leave or end the round or the game at the bottom, in red; a
        // long menu scrolls on a phone
        <div className="menu">
          <div className="group">
            {newVersion && (
              <button className="news" onClick={() => location.reload()}>
                {t("Update to the new version")}
              </button>
            )}
            <label className="volume">
              {t("Sound")}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </label>
          </div>
          {/* standing leaves your hand to whoever sits down, you again too:
              nothing lost, so one tap */}
          <div className="group">
            {me && (
              <button onClick={then(() => stand(me))}>{t("Stand")}</button>
            )}
            {/* mid-round a seat joins the round only from here, dealt a hand
                from the middle pile (okey.sit); between rounds, Sit */}
            {!me && free.length > 0 && (
              <Confirm
                label={t("Sit down in this round")}
                onConfirm={then(() => sit(free[0]))}
              />
            )}
          </div>
          {/* anyone's, gone or still here: mid-round every seat is in the
              round, stood up from or not, and leaves it (okey.freeSeat) */}
          <div className="group">
            {okeyState.players
              .filter((p) => (p.user || p.away || playing) && p.id !== me)
              .map((p) => (
                <Confirm
                  key={p.id}
                  label={t(`Free seat: ${p.user?.name ?? t(`Player ${p.id}`)}`)}
                  onConfirm={then(() => freeSeat(p.id))}
                />
              ))}
            {free.map((id) => (
              <Confirm
                key={id}
                label={t(`Add a bot: ${t(`Player ${id}`)}`)}
                onConfirm={then(() => seatBot(id))}
              />
            ))}
          </div>
          <div className="group">
            <button onClick={() => show("how")}>{t("How to play")}</button>
            <button onClick={() => show("load")}>{t("Saved games")}</button>
            <button onClick={() => show("setup")}>{t("Set up a game")}</button>
            {/* the game's rules, those it reads as it's played (the lobby has ⚙) */}
            {okeyState.gameState !== "start" && (
              <button onClick={() => show("rules")}>{t("Rules")}</button>
            )}
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
          </div>
          <div className="group ends">
            {/* leaving takes your hand out of the round */}
            {me && playing && (
              <Confirm
                label={t("Leave the round")}
                onConfirm={then(() => freeSeat(me))}
              />
            )}
            {/* the pile ran out (reshuffle), and whoever's turn it is calls it */}
            {okey.pileOut(okeyState, me) && (
              <Confirm
                label={t("End the round")}
                onConfirm={then(() => act(okey.endPile, me))}
              />
            )}
            {/* someone stands or sits mid-round: back to before the deal */}
            {playing && (
              <Confirm
                label={t("Deal this round again")}
                onConfirm={then(redealRound)}
              />
            )}
            {okeyState.gameState !== "start" && (
              <Confirm label={t("New Game")} onConfirm={then(newGame)} />
            )}
            <Confirm label={t("Reset Game")} onConfirm={then(resetGame)} />
          </div>
        </div>
      )}
      {dialog === "load" && <LoadDialog onClose={() => setDialog(null)} />}
      {dialog === "setup" && <SetUpDialog onClose={() => setDialog(null)} />}
      {dialog === "rules" && <TableSettings onClose={() => setDialog(null)} />}
      {dialog === "how" && (
        <HowToPlay
          game="okey"
          // the game's rules, or in the lobby the ones picked
          mode={okeyKind(okeyState.rules ?? okeyState.setup)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
