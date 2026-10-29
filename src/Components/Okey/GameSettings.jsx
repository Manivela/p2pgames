import { useContext, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { isEqual, omit } from "lodash";
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
  roundName,
} from "./rulesets";
import { customNanoid } from "../../utils/customNanoid";
import { t } from "../../i18n";

// How a hand opens, which decides the rest: nothing, finished from the hand
// (classic; scored once it's more than one hand), each round's melds
// (Americano), or points or pairs (101).
const modeOf = (r) =>
  r.opening ? "points" : r.rounds?.some((x) => x.melds) ? "melds" : "hand";

// [key, label, the value when the ruleset has none, the openings it's for
// ("h" from the hand over more than one hand, "m" melds, "p" points; none
// for every one, a classic hand too), the switch it hangs on]
const RULES = [
  ["partners", "Partners", false, "hmp"],
  ["doubling", "Doubling", true, "hmp"],
  ["outOfTurnTakes", "Out-of-turn takes", false, "hmp"],
  ["takeMustBeUsed", "A taken discard goes into a meld", false, "mp"],
  ["buildWhenOpening", "Lay more on the turn you open", false, "mp"],
  ["swapOkeys", "Swap table okeys", false, "mp"],
  ["catchUntilDraw", "Caught only before the next draw", false, "mp"],
  ["takeCaught", "A caught tile can still be taken", false, "mp"],
  ["pairsForAll", "Pairs for all", false, "p"],
  ["finishInOne", "Finish in one go", false, "p"],
  ["pileOutCounts", "Empty pile scores", false, "p"],
  ["notOpenedCounts", "Not opened: okeys held count, doubled", false, "mp"],
  ["wrapRuns", "12-13-1 is a run", false],
];
const NUMBERS = [
  ["seats", "Most players", 4],
  ["tileSets", "Tile sets", 2],
  ["handSize", "Tiles dealt", 14],
  ["rowSlots", "Rack row", 13],
  ["maxTakes", "Takes a round", 3, "hmp", "outOfTurnTakes"],
  ["claimWaitSeconds", "Seconds to take", 8, "hmp", "outOfTurnTakes"],
  ["okeySwapFromRound", "Before opening, from round", null, "mp", "swapOkeys"],
  ["pairsAddMax", "Pairs opener adds a turn", 0, "p"],
];
const SCORES = [
  ["finishScore", "Finishing", -20, "hmp"],
  ["notOpenedScore", "Not opened", 100, "mp"],
  ["okeyInHandScore", "Okey left in hand", 25, "hmp"],
  ["catchPenalty", "Caught discard", 20, "mp"],
  ["okeyDiscardPenalty", "Throwing the okey", 0, "mp"],
  ["returnPenalty", "Putting it back", 0, "mp", "takeMustBeUsed"],
  ["indicatorScore", "Showing the indicator", 0, "hmp"],
];

// what each setting does, on its label (a tooltip)
const ABOUT = {
  opening:
    "How a hand opens: finished from the hand (classic), each round's melds (Americano), or points or pairs (101)",
  hands:
    "Hands in the game; one hand finished from the hand is classic, unscored",
  points: "Sets and runs worth this much at face value open a hand",
  pairs: "Or this many pairs open it",
  partners:
    "Four in two pairs across the table: a team scores both partners' totals, and the finisher's partner pays nothing for their hand",
  doubling:
    "The okey thrown last doubles everyone else's score; in 101 a win with pairs or in one go does too",
  outOfTurnTakes:
    "Anyone may take the last discard out of turn, with an extra tile from the pile",
  takeMustBeUsed:
    "A discard taken goes into a meld before that turn's discard, or back on its pile",
  buildWhenOpening: "Lay more melds and add to the table on the turn you open",
  swapOkeys: "A table okey goes to whoever puts down the tile it stands for",
  catchUntilDraw:
    "A discard that fits a table meld can be caught only until the next player draws",
  takeCaught: "A caught discard can still be taken by the next player",
  pairsForAll: "Once someone opens with pairs, everyone lays pairs",
  finishInOne:
    "Laying all but one tile at once and finishing opens below the points too",
  pileOutCounts: "A pile that runs out ends the hand, scored as usual",
  notOpenedCounts:
    "Not opening scores the okeys held too, and doubles with the rest",
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
// the settings a ruleset's opening reads
const shown = (r, fields) => {
  const mode = modeOf(r);
  const m = mode === "hand" ? (r.rounds ? "h" : "") : mode[0];
  return fields.filter(
    ([, , , modes, when]) =>
      (!modes || (m && modes.includes(m))) && (!when || value(r, field(when))),
  );
};

// the ruleset with every setting its opening reads filled in: one made from
// another opening lacks some
function complete(r) {
  const out = { ...r };
  for (const f of shown(r, [...RULES, ...NUMBERS, ...SCORES])) {
    out[f[0]] = value(r, f);
  }
  return out;
}

// the start refused, and why
const check = (r) => invalid(complete(r));

// The switches on that no game opened this way has been played with: its
// preset's are, and 101's own options both ways. Players may try them; a
// rule that breaks would break mid-game, for the whole table.
const PLAYED = { hand: CLASSIC, melds: AMERICANO, points: ONE_O_ONE };
const OPTIONS = { points: ["partners", "doubling"] };
const untested = (r) => {
  const mode = modeOf(r);
  return shown(r, RULES)
    .filter(
      (f) =>
        value(r, f) &&
        !value(PLAYED[mode], f) &&
        !OPTIONS[mode]?.includes(f[0]),
    )
    .map((f) => t(f[1]));
};

const numbered = (n) =>
  Array.from({ length: n }, (_, i) => ({ name: `${i + 1}` }));
const fromHand = (n) =>
  Array.from({ length: n }, () => ({ name: roundName(null), melds: null }));
const withRounds = (r, rounds) =>
  rounds ? { ...r, rounds } : omit(r, "rounds");

// the ruleset opened another way: its number of hands kept, Americano's
// rounds for melds, 101's opening for points
function withMode(r, mode) {
  const { opening, ...rest } = r;
  const hands = r.rounds?.length ?? 1;
  if (mode === "points") {
    return {
      ...rest,
      opening: opening ?? ONE_O_ONE.opening,
      rounds: numbered(hands),
    };
  }
  if (mode === "melds") return { ...rest, rounds: AMERICANO.rounds };
  return withRounds(rest, hands > 1 && fromHand(hands));
}

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
  const mode = modeOf(setup);
  const hands = setup.rounds?.length ?? 1;
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
  const MODES = {
    hand: "From the hand",
    melds: "Each round's melds",
    points: "Points or pairs",
  };
  const setRound = (i, melds) =>
    set({
      rounds: setup.rounds.map((r, j) =>
        j === i ? { name: roundName(melds), melds } : r,
      ),
    });
  return (
    <Dialog title={t("Game settings")} className="settings" onClose={onClose}>
      <Setting
        className="inline"
        about={ABOUT.opening}
        now={mode}
        was={base && modeOf(base)}
        format={(m) => t(MODES[m])}
        input={
          <select
            id="setup-opening"
            value={mode}
            onChange={(e) => setSetup(withMode(setup, e.target.value))}
          >
            {Object.entries(MODES).map(([m, label]) => (
              <option key={m} value={m}>
                {t(label)}
              </option>
            ))}
          </select>
        }
      >
        {t("Opening")}
      </Setting>
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
      <div className="numbers">
        {mode !== "melds" && (
          <Setting
            about={ABOUT.hands}
            now={hands}
            was={base && (base.rounds?.length ?? 1)}
            input={
              <input
                type="number"
                value={hands}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(50, number(e.target.value)));
                  setSetup(
                    withRounds(
                      setup,
                      mode === "points" ? numbered(n) : n !== 1 && fromHand(n),
                    ),
                  );
                }}
              />
            }
          >
            {t("Hands")}
          </Setting>
        )}
        {mode === "points" &&
          ["points", "pairs"].map((k) => (
            <Setting
              key={k}
              about={ABOUT[k]}
              now={setup.opening[k]}
              was={base && (base.opening ?? ONE_O_ONE.opening)[k]}
              input={
                <input
                  type="number"
                  value={setup.opening[k] ?? ""}
                  onChange={(e) =>
                    set({
                      opening: {
                        ...setup.opening,
                        [k]: number(e.target.value),
                      },
                    })
                  }
                />
              }
            >
              {t(k === "points" ? "Opening points" : "Opening pairs")}
            </Setting>
          ))}
        {shown(setup, NUMBERS).map(numberField)}
      </div>
      {setup.rounds && (
        <>
          <h4>{t("Scores")}</h4>
          <div className="numbers">{shown(setup, SCORES).map(numberField)}</div>
        </>
      )}
      {mode === "melds" && (
        <>
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
                {r.melds?.map((m, j) => (
                  <select
                    key={j}
                    value={m.join("-")}
                    onChange={(e) => {
                      const melds = r.melds.flatMap((x, k) =>
                        k !== j
                          ? [x]
                          : e.target.value
                            ? [
                                MELDS.find(
                                  (y) => y.join("-") === e.target.value,
                                ),
                              ]
                            : [],
                      );
                      setRound(i, melds.length ? melds : null);
                    }}
                  >
                    <option value="">—</option>
                    {MELDS.map((y) => (
                      <option key={y.join("-")} value={y.join("-")}>
                        {meldName(y)}
                      </option>
                    ))}
                  </select>
                )) ?? <span>{t(roundName(null))}</span>}
                <button
                  aria-label={t("Add a meld")}
                  onClick={() => setRound(i, [...(r.melds ?? []), ["kut", 3]])}
                >
                  +
                </button>
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
          <button
            onClick={() =>
              set({
                rounds: [
                  ...setup.rounds,
                  { name: roundName(null), melds: null },
                ],
              })
            }
          >
            {t("Add a round")}
          </button>
        </>
      )}
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
