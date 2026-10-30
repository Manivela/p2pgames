import { useContext, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { isEqual, uniq } from "lodash";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import { Confirm, Dialog } from "./TableMenu";
import {
  AMERICANO,
  CLASSIC,
  ONE_O_ONE,
  PRESETS,
  SIZES,
  allRulesets,
  dropRuleset,
  invalid,
  keepRuleset,
  keptRulesets,
  pointsRound,
  roundName,
} from "./rulesets";
import { customNanoid } from "../../utils/customNanoid";
import { t } from "../../i18n";

// [key, label, the value when the ruleset has none, the switch it hangs
// on]. Every ruleset shows every one: what one is about (pairs openers,
// the pair round, the table's melds) comes up in the rounds that have it.
const RULES = [
  ["partners", "Partners", false],
  ["doubling", "Doubling", true],
  ["finishDoubled", "Doubling counts for the finisher", false, "doubling"],
  ["outOfTurnTakes", "Out-of-turn takes", false],
  ["takeMustBeUsed", "A taken discard goes into a meld", false],
  ["buildWhenOpening", "Lay more on the turn you open", false],
  ["swapOkeys", "Swap table okeys", false],
  ["catchUntilDraw", "Caught only before the next draw", false],
  ["takeCaught", "A caught tile can still be taken", false],
  ["peekPairRounds", "Look through the discards on pair rounds", false],
  ["pairsForAll", "Pairs for all", false],
  ["finishInOne", "Finish in one go", false],
  ["raiseOpening", "Each opening beats the last", false],
  ["reshuffle", "Shuffle the discards into a new pile", false],
  ["pileOutCounts", "Empty pile scores", true],
  ["notOpenedCounts", "Not opened: okeys held count, doubled", false],
  ["notOpenedHand", "Not opened: the hand is counted", false],
  ["wrapRuns", "12-13-1 is a run", false],
];
const NUMBERS = [
  ["seats", "Most players", 4],
  ["tileSets", "Tile sets", 2],
  ["handSize", "Tiles dealt", 14],
  ["rowSlots", "Rack row", 13],
  ["maxTakes", "Takes a round", 3, "outOfTurnTakes"],
  ["claimWaitSeconds", "Seconds to take", 8, "outOfTurnTakes"],
  ["okeySwapFromRound", "Before opening, from round", null, "swapOkeys"],
  ["pairsAddMax", "Pairs opener adds a turn", 0],
];
const SCORES = [
  ["finishScore", "Finishing", -20],
  ["notOpenedScore", "Not opened", 100],
  ["okeyInHandScore", "Okey left in hand", 25],
  ["catchPenalty", "Caught discard", 20],
  ["okeyDiscardPenalty", "Throwing the okey", 0],
  ["returnPenalty", "Putting it back", 0, "takeMustBeUsed"],
  ["indicatorScore", "Showing the indicator", 0],
];

// what each setting does, on its label (a tooltip)
const ABOUT = {
  round:
    "How the round opens: with these melds, with sets and runs worth the points or with the pairs, or not at all, finished from the hand",
  points: "Sets and runs worth this much at face value open a hand",
  pairs: "Or this many pairs open it",
  partners:
    "Four in two pairs across the table: a team scores both partners' totals, and the finisher's partner pays nothing for their hand",
  doubling:
    "The okey thrown last doubles everyone else's score; so does a win with pairs or in one go",
  finishDoubled:
    "Doubling doubles the finisher's score too; off: finishing always scores the same",
  outOfTurnTakes:
    "Anyone may take the last discard out of turn, with an extra tile from the pile",
  takeMustBeUsed:
    "A discard taken goes into a meld before that turn's discard, or back on its pile",
  buildWhenOpening: "Lay more melds and add to the table on the turn you open",
  swapOkeys: "A table okey goes to whoever puts down the tile it stands for",
  catchUntilDraw:
    "A discard that fits a table meld can be caught only until the next player draws",
  takeCaught: "A caught discard can still be taken by the next player",
  peekPairRounds:
    "On a round that opens with pairs, a tap on a discard pile spreads its tiles out to look through",
  pairsForAll: "Once someone opens with pairs, everyone lays pairs",
  finishInOne:
    "Laying all but one tile at once and finishing opens below the points too",
  raiseOpening:
    "Opening with points takes more than the highest opening so far this hand",
  reshuffle:
    "When the pile runs out, the player whose turn it is can shuffle the discards into a new pile and play on, or end the round",
  pileOutCounts:
    "A pile that runs out ends the hand, scored as usual; off: it's dealt again, and only the okeys held score",
  notOpenedCounts:
    "Not opening scores the okeys held too, and doubles with the rest",
  notOpenedHand:
    "A player who didn't open scores their hand like everyone else, in place of the Not opened score",
  wrapRuns: "A run can go on from 13 to 1",
  seats: "The most players who can sit at the table",
  tileSets: "Sets of 53 tiles: two as usual, more for a bigger table",
  handSize: "Tiles dealt to each player; whoever starts gets one more",
  rowSlots: "Slots in each of the rack's two rows",
  maxTakes: "Out-of-turn takes each player has a round",
  claimWaitSeconds:
    "Seconds the others have to take the discard once the player whose turn it is draws from the pile",
  okeySwapFromRound:
    "From this round a table okey can be taken before opening too; empty: only once you've opened",
  pairsAddMax:
    "Tiles a pairs opener can add to sets and runs a turn; 0: no limit",
  finishScore: "Written for whoever finishes",
  notOpenedScore: "Written for a player who didn't open",
  okeyInHandScore: "Written for each okey left in a hand",
  catchPenalty:
    "Written for throwing a tile that fit a table meld, when it's caught",
  okeyDiscardPenalty:
    "Written for throwing the okey, unless it's the last tile; 0: none",
  returnPenalty: "Written for taking the discard and putting it back",
  indicatorScore:
    "Written for showing the indicator's twin on your first turn (a minus takes it off); 0: none",
};

const value = (r, [key, , fallback]) => r[key] ?? fallback;
// a setting as it reads: on or off, a number, or none
const shownValue = (v) =>
  typeof v === "boolean" ? t(v ? "on" : "off") : (v ?? "—");
const field = (key) =>
  [...RULES, ...NUMBERS, ...SCORES].find(([k]) => k === key);
// the settings a ruleset reads: all but those hanging on a switch it has off
const shown = (r, fields) =>
  fields.filter(([, , , when]) => !when || value(r, field(when)));

// the ruleset with every setting it reads filled in: one made by an older
// build, or a preset, lacks some
function complete(r) {
  const out = { ...r };
  for (const f of shown(r, [...RULES, ...NUMBERS, ...SCORES])) {
    out[f[0]] = value(r, f);
  }
  return out;
}

// the start refused, and why
const check = (r) => invalid(complete(r));

// How a round opens: with melds, points (or pairs), or from the hand
const kindOf = (round) =>
  round.opening ? "points" : round.melds ? "melds" : "hand";
const KINDS = {
  melds: "Melds",
  points: "Points or pairs",
  hand: "From the hand",
};
const ELDEN = { name: roundName(null), melds: null };
const asKind = (kind) =>
  kind === "melds"
    ? { name: roundName([["kut", 3]]), melds: [["kut", 3]] }
    : kind === "points"
      ? ONE_O_ONE.rounds[0]
      : ELDEN;

// The switches on that no game opening the same way has been played with:
// its preset's are (Americano's for melds, 101's for points, classic's for
// a game all from the hand), and 101's own options both ways; scoring
// can't break a game. Players may try them; a rule that breaks would break
// mid-game, for the whole table.
const PLAYED = { hand: CLASSIC, melds: AMERICANO, points: ONE_O_ONE };
const OPTIONS = { points: ["partners", "doubling", "raiseOpening"] };
const SCORING = ["finishDoubled", "notOpenedCounts", "notOpenedHand"];
const untested = (r) => {
  const kinds = uniq(r.rounds.map(kindOf));
  const played = kinds.length > 1 ? kinds.filter((k) => k !== "hand") : kinds;
  return shown(r, RULES)
    .filter(
      (f) =>
        value(r, f) &&
        !SCORING.includes(f[0]) &&
        played.some((k) => !value(PLAYED[k], f) && !OPTIONS[k]?.includes(f[0])),
    )
    .map((f) => t(f[1]));
};

// what an opening's dropdown offers: every size each kind of meld can be
const MELDS = Object.entries(SIZES).flatMap(([type, [lo, hi]]) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => [type, lo + i]),
);
const meldName = ([type, size]) =>
  type === "pair" ? t("Pair") : t(roundName([[type, size]]));

const number = (v) => (v === "" ? null : Number(v));

// The lobby: the rules the next game starts with, shared by everyone in the
// room (`setup`) and anyone's to change; picked from the presets and this
// device's, and changed in the settings (⚙).
export function Lobby() {
  const { okeyState, startGame, setSetup } = useContext(OkeyContext);
  const [open, setOpen] = useState(false);
  const setup = okeyState.setup ?? CLASSIC;
  const list = allRulesets();
  const base = list.find((r) => r.id === setup.id);
  // as played: a game started from it, and the next set up from that, holds
  // every setting filled in
  const changed = base && !isEqual(complete(base), complete(setup));
  const start = () => {
    const no = check(setup);
    if (no) toast(t(no));
    else startGame(complete(setup));
  };
  return (
    <>
      <span className="pick">
        <select
          aria-label={t("Rules")}
          value={setup.id}
          onChange={(e) => setSetup(list.find((r) => r.id === e.target.value))}
        >
          {/* someone else's, not kept on this device */}
          {(base ? list : [...list, setup]).map((r) => (
            <option key={r.id} value={r.id}>
              {/* changed for the next game: short, a phone has room for little */}
              {r.id === setup.id && changed ? `${r.name} *` : r.name}
            </option>
          ))}
        </select>
        <button aria-label={t("Game settings")} onClick={() => setOpen(true)}>
          ⚙
        </button>
      </span>
      <button onClick={start}>{t("Start")}</button>
      {untested(setup).length > 0 && (
        <small className="untested">{t("Untested rules")}</small>
      )}
      {open &&
        createPortal(
          <Settings
            base={base}
            changed={changed}
            start={start}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

// A setting's label: what it does as its tooltip, and, changed from the
// ruleset's (`base`), marked with what it was
function Setting({
  about,
  now,
  was,
  format = shownValue,
  className = "",
  children,
  input,
  // a checkbox goes before its words, a field after them
  inputFirst = false,
}) {
  const changed = was !== undefined && !isEqual(now, was);
  return (
    <label
      className={`${className} ${changed ? "changed" : ""}`}
      title={t(about)}
    >
      {inputFirst && input}
      <span>
        {children}
        {changed && (
          <small className="was">{t(`default: ${format(was)}`)}</small>
        )}
      </span>
      {!inputFirst && input}
    </label>
  );
}

function Toggle({ f, setup, base }) {
  const { setSetup } = useContext(OkeyContext);
  const [key, label] = f;
  return (
    <Setting
      about={ABOUT[key]}
      now={value(setup, f)}
      was={base && value(base, f)}
      inputFirst
      input={
        <input
          type="checkbox"
          checked={value(setup, f)}
          onChange={(e) => setSetup({ ...setup, [key]: e.target.checked })}
        />
      }
    >
      {t(label)}
    </Setting>
  );
}

// Every setting of the rules the next game starts with, to change for that
// game or keep on this device as a ruleset of its own. `base`: the ruleset
// they come from (none when it isn't on this device), to mark what changed
// and go back to.
function Settings({ base, changed, start, onClose }) {
  const { okeyState, setSetup } = useContext(OkeyContext);
  const setup = okeyState.setup ?? CLASSIC;
  const set = (change) => setSetup({ ...setup, ...change });
  // a preset's own name is taken
  const [name, setName] = useState(
    PRESETS.some((p) => p.id === setup.id) ? "" : setup.name,
  );
  const [, kept] = useReducer((n) => n + 1, 0);
  const mine = keptRulesets().some((r) => r.id === setup.id);
  const save = () => {
    const trimmed = name.trim();
    if (PRESETS.some((p) => p.name === trimmed)) {
      return toast(t("That name is taken"));
    }
    // under a name of your own, it's that one again
    const same = keptRulesets().find((r) => r.name === trimmed);
    const r = complete({
      ...setup,
      name: trimmed,
      id: same?.id ?? customNanoid(),
    });
    const no = invalid(r);
    if (no) return toast(t(no));
    keepRuleset(r);
    setSetup(r);
    toast(t("Saved on this device"));
  };
  const numberField = (f) => (
    <Setting
      key={f[0]}
      about={ABOUT[f[0]]}
      now={value(setup, f)}
      was={base && value(base, f)}
      input={
        <input
          type="number"
          placeholder="—"
          value={setup[f[0]] === undefined ? (f[2] ?? "") : (setup[f[0]] ?? "")}
          onChange={(e) => set({ [f[0]]: number(e.target.value) })}
        />
      }
    >
      {t(f[1])}
    </Setting>
  );
  const setRound = (i, round) =>
    set({ rounds: setup.rounds.map((r, j) => (j === i ? round : r)) });
  // a points round's points, or its pairs
  const openingField = (i, r, k) => (
    <input
      type="number"
      className={k}
      aria-label={t(k === "points" ? "Opening points" : "Opening pairs")}
      title={t(ABOUT[k])}
      value={r.opening[k] ?? ""}
      onChange={(e) =>
        setRound(i, pointsRound({ ...r.opening, [k]: number(e.target.value) }))
      }
    />
  );
  return (
    <Dialog title={t("Game settings")} className="settings" onClose={onClose}>
      <h4>{t("Rules")}</h4>
      <div className="chips">
        {shown(setup, RULES).map((f) => (
          <Toggle key={f[0]} f={f} setup={setup} base={base} />
        ))}
      </div>
      {untested(setup).length > 0 && (
        <p className="untested">
          {t(
            `Never played with ${untested(setup).join(", ")}: it may break mid-game`,
          )}
        </p>
      )}
      <h4>{t("Numbers")}</h4>
      <div className="numbers">{shown(setup, NUMBERS).map(numberField)}</div>
      <h4>{t("Scores")}</h4>
      <div className="numbers">{shown(setup, SCORES).map(numberField)}</div>
      <h4>
        {t("Rounds")}
        {base && !isEqual(base.rounds, setup.rounds) && (
          <small className="was">{t("changed")}</small>
        )}
      </h4>
      <ul className="rounds">
        {setup.rounds.map((r, i) => (
          <li key={i}>
            <b>{i + 1}.</b>
            <select
              aria-label={t("Opening")}
              title={t(ABOUT.round)}
              value={kindOf(r)}
              onChange={(e) => setRound(i, asKind(e.target.value))}
            >
              {Object.entries(KINDS).map(([k, label]) => (
                <option key={k} value={k}>
                  {t(label)}
                </option>
              ))}
            </select>
            {r.melds?.map((m, j) => (
              <select
                key={j}
                value={m.join("-")}
                onChange={(e) => {
                  const melds = r.melds.flatMap((x, k) =>
                    k !== j
                      ? [x]
                      : e.target.value
                        ? [MELDS.find((y) => y.join("-") === e.target.value)]
                        : [],
                  );
                  setRound(
                    i,
                    melds.length ? { name: roundName(melds), melds } : ELDEN,
                  );
                }}
              >
                <option value="">—</option>
                {MELDS.map((y) => (
                  <option key={y.join("-")} value={y.join("-")}>
                    {meldName(y)}
                  </option>
                ))}
              </select>
            ))}
            {r.melds && (
              <button
                aria-label={t("Add a meld")}
                onClick={() => {
                  const melds = [...r.melds, ["kut", 3]];
                  setRound(i, { name: roundName(melds), melds });
                }}
              >
                +
              </button>
            )}
            {r.opening && (
              <>
                {openingField(i, r, "points")}
                <span>{t("or")}</span>
                {openingField(i, r, "pairs")}
                <span>{t("pairs")}</span>
              </>
            )}
            {setup.rounds.length > 1 && (
              <button
                aria-label={t("Remove the round")}
                onClick={() =>
                  set({ rounds: setup.rounds.filter((_, j) => j !== i) })
                }
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* like the last, to change */}
      <button
        onClick={() => set({ rounds: [...setup.rounds, setup.rounds.at(-1)] })}
      >
        {t("Add a round")}
      </button>
      <h4>{t("Keep on this device")}</h4>
      <p className="inline">
        <input
          aria-label={t("Name")}
          placeholder={t("Name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={save}>{t("Save")}</button>
        {mine && (
          <Confirm
            label={t("Delete")}
            onConfirm={() => {
              dropRuleset(setup.id);
              kept();
            }}
          />
        )}
      </p>
      <p className="actions">
        <button className="start" onClick={start}>
          {t("Start")}
        </button>
        {changed && (
          <button onClick={() => setSetup(base)}>{t("Undo changes")}</button>
        )}
      </p>
    </Dialog>
  );
}
