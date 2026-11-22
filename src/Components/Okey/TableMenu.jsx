import { useContext, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { sum, uniqBy } from "lodash";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import * as okey from "./okey";
import { allRulesets } from "./rulesets";
import { TableSettings } from "./GameSettings";
import { t } from "../../i18n";
import { Confirm } from "../Confirm";
import { Dialog, SavedGames, useAutoSave } from "../Saves";
import Settings from "../Settings";
import { useRackRow } from "../../hooks/useStore";
import { useDismiss } from "../../hooks/useKey";

export { Confirm, Dialog };

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

// the games kept (Saves.jsx), each seat going to whoever sits in it now
function LoadDialog({ onClose }) {
  const { okeyState, loadGame } = useContext(OkeyContext);
  return (
    <SavedGames
      name="okey"
      state={okeyState}
      decode={okey.decodeSave}
      summary={summary}
      seats={(saved) =>
        saved.players.map((p) => [
          t(`Player ${p.id}`),
          p.user?.name,
          okeyState.players.find((x) => x.id === p.id)?.user?.name,
        ])
      }
      load={(saved) => loadGame(okey.restore(saved, okeyState))}
      onClose={onClose}
    />
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
// as it was, the room and player as tags, and, for players who can't see
// each other (TODO.md), whom this page was connected to and whose presence
// it had as the form opened (root.jsx's window.room), beside each seat's
// presence key (`userKey`).
let feedback, form, saveCode, connections;
async function report(okeyState, tags) {
  const { Sentry, room } = window;
  saveCode = await okey.encodeSave(okeyState);
  connections = JSON.stringify(
    {
      me: room?.me(),
      peers: room?.peers(),
      tabs: room?.tabs(),
      presence: room?.presence(),
      seats: okeyState.players
        .filter((p) => p.user || p.away)
        .map((p) => ({
          id: p.id,
          name: p.user?.name ?? p.awayName ?? null,
          key: p.userKey ?? null,
          away: !!p.away,
        })),
    },
    null,
    2,
  );
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
            { filename: "connections.json", data: connections },
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
    newVersion,
    check,
    together,
  } = useContext(OkeyContext);
  const { roomId } = useParams();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  // a game in the lobby has nothing to keep yet
  useAutoSave(
    "okey",
    okeyState.gameState === "start" ? null : okeyState,
    okeyState.gameId,
  );
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
  const menu = useRef();
  useDismiss(menu, open && (() => setOpen(false)));
  return (
    <div className="table-menu" ref={menu}>
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
        // in groups, a line between them (an empty one takes none): the
        // settings, your seat, the others', the game's tools, and the moves
        // that leave or end the round or the game at the bottom, in red; a
        // long menu scrolls on a phone
        <div className="menu">
          <div className="group">
            {newVersion && (
              <button className="news" onClick={() => location.reload()}>
                {t("Update to the new version")}
              </button>
            )}
            <button onClick={() => show("settings")}>{t("Settings")}</button>
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
            {/* back from a break: no move till everyone's pressed Ready */}
            {check.start && (
              <button onClick={then(check.start)}>{t("Ready check")}</button>
            )}
            {check.cancel && (
              <button onClick={then(check.cancel)}>
                {t("End the ready check")}
              </button>
            )}
            {/* a player who can't press Next Round: on without them */}
            {together.force && (
              <Confirm
                label={t("Go on without waiting")}
                onConfirm={then(together.force)}
              />
            )}
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
      {dialog === "settings" && (
        <Settings device={<RackRow />} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

// Your rack's rows on this device (useRackRow), at every game you sit at;
// empty: the table's. Taken on Enter or leaving the field, as a number
// half typed doesn't fit; one this game's rules won't take says why, and
// the table's is played meanwhile (OkeyContext).
function RackRow() {
  const { okeyState, me } = useContext(OkeyContext);
  const { row, setRow } = useRackRow();
  const [draft, setDraft] = useState(row ?? "");
  const take = () => {
    const v = draft === "" ? null : Number(draft);
    if (v === row) return;
    setRow(v);
    const no = me && okey.setRow(okeyState, me, v);
    if (typeof no === "string") toast(t(no));
  };
  return (
    <label>
      <span>{t("Slots in each row of your own rack; empty: the table's")}</span>
      <input
        type="number"
        placeholder={String(
          (okeyState.rules ?? okeyState.setup)?.rowSlots ?? 13,
        )}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={take}
        onKeyDown={(e) => e.key === "Enter" && take()}
      />
    </label>
  );
}
