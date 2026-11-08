import { Fragment, useContext, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { isEmpty, isEqual, pickBy, uniq } from "lodash";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import { Confirm, Dialog } from "./TableMenu";
import {
  AMERICANO,
  CLASSIC,
  DEFAULTS,
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

// Every setting, by what it's about, as [key, what it does, the switch it
// hangs on (`!`: on it being off), shown under it]: a switch where the
// ruleset has true or false, a number otherwise. Every ruleset shows every
// one: what one is about (pairs openers, the pair round, the table's melds)
// comes up in the rounds that have it.
const GROUPS = [
  [
    "The table",
    [
      ["seats", "The most players who can sit at the table"],
      [
        "partners",
        "Four in two pairs across the table: a team scores both partners' totals, and the finisher's partner pays nothing for their hand",
      ],
      ["tileSets", "Sets of 53 tiles: two as usual, more for a bigger table"],
      ["handSize", "Tiles dealt to each player; whoever starts gets one more"],
      ["rowSlots", "Slots in each of the rack's two rows"],
    ],
  ],
  [
    "Opening and laying down",
    [
      ["wrapRuns", "A run can go on from 13 to 1"],
      [
        "buildWhenOpening",
        "Lay more melds and add to the table on the turn you open",
      ],
      [
        "raiseOpening",
        "Opening with points takes more than the highest opening so far this hand",
      ],
      [
        "finishInOne",
        "Laying all but one tile at once and finishing opens below the points too",
      ],
      ["pairsForAll", "Once someone opens with pairs, everyone lays pairs"],
      [
        "pairsAddMax",
        "Tiles a pairs opener can add to sets and runs a turn; 0: no limit",
      ],
      [
        "swapOkeys",
        "A table okey goes to whoever puts down the tile it stands for",
      ],
      [
        "okeySwapFromRound",
        "From this round a table okey can be taken before opening too; empty: only once you've opened",
        "swapOkeys",
      ],
    ],
  ],
  [
    "The discards",
    [
      [
        "outOfTurnTakes",
        "Anyone may take the last discard out of turn, with an extra tile from the pile",
      ],
      [
        "maxTakes",
        "Out-of-turn takes each player has a round",
        "outOfTurnTakes",
      ],
      [
        "claimWaitSeconds",
        "Seconds the others have to take the discard once the player whose turn it is draws from the pile",
        "outOfTurnTakes",
      ],
      [
        "takeMustBeUsed",
        "A discard taken goes into a meld before that turn's discard, or back on its pile",
      ],
      [
        "returnPenalty",
        "Written for taking the discard and putting it back",
        "takeMustBeUsed",
      ],
      [
        "catchPenalty",
        "Written for throwing a tile that fit a table meld, when it's caught",
      ],
      [
        "catchWaitSeconds",
        "Seconds the others have to catch a discard before the next player can take it",
      ],
      [
        "catchUntilDraw",
        "A discard that fits a table meld can be caught only until the next player draws",
      ],
      ["takeCaught", "A caught discard can still be taken by the next player"],
      [
        "peekPairRounds",
        "On a round that opens with pairs, a tap on a discard pile spreads its tiles out to look through",
      ],
      [
        "peekWithPairs",
        "Once someone has opened with pairs, a tap on a discard pile spreads its tiles out to look through",
      ],
    ],
  ],
  [
    "When the pile runs out",
    [
      [
        "reshuffle",
        "The player whose turn it is can shuffle the discards into a new pile and play on, or end the round",
      ],
      [
        "pileOutCounts",
        "A round that ends this way is scored as usual; off: it's dealt again, and only the okeys held score",
      ],
    ],
  ],
  [
    "Scores",
    [
      ["finishScore", "Written for whoever finishes"],
      ["okeyInHandScore", "Written for each okey left in a hand"],
      [
        "okeyDiscardPenalty",
        "Written for throwing the okey, unless it's the last tile; 0: none",
      ],
      [
        "notOpenedHand",
        "A player who didn't open scores their hand like everyone else",
      ],
      [
        "notOpenedScore",
        "Written for a player who didn't open",
        "!notOpenedHand",
      ],
      [
        "notOpenedCounts",
        "Not opening scores the okeys held too, and doubles with the rest",
        "!notOpenedHand",
      ],
      [
        "doubling",
        "The okey thrown last doubles everyone else's score; so does a win with pairs or in one go",
      ],
      [
        "finishDoubled",
        "The finisher's score doubles too; off: finishing always scores the same",
        "doubling",
      ],
    ],
  ],
  [
    "Bots",
    [
      [
        "botMistakes",
        "Times in 100 a bot misses a good move: a discard to take, a catch, an opening, the best tile to throw; 0: it plays its best",
      ],
      [
        "botCatches",
        "Times in 100 a bot catches a thrown tile that fits a table meld; 100: every one",
      ],
    ],
  ],
];
const isSwitch = (key) => typeof DEFAULTS[key] === "boolean";

// a setting as it reads: on or off, a number, or none
const shownValue = (v) =>
  typeof v === "boolean" ? t(v ? "on" : "off") : (v ?? "—");
const on = (r, when) =>
  when.startsWith("!") ? !on(r, when.slice(1)) : r[when];
// the settings a ruleset reads: all but those hanging on a switch it
// doesn't have as they need
const shown = (r, fields = GROUPS.flatMap(([, f]) => f)) =>
  fields.filter(([, , when]) => !when || on(r, when));

// the start refused, and why: an emptied number (but the one that means
// something empty), or what `invalid` finds
const check = (r) =>
  shown(r).some(([key]) => typeof DEFAULTS[key] === "number" && r[key] == null)
    ? "Fill in every number"
    : invalid(r);

// what the rounds below it are, under their heading
const ROUNDS =
  "How the round opens: with these melds, with sets and runs worth the points or with the pairs, or not at all, finished from the hand";

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
  return shown(r)
    .map(([key]) => key)
    .filter(
      (key) =>
        r[key] === true &&
        !SCORING.includes(key) &&
        played.some((k) => !PLAYED[k][key] && !OPTIONS[k]?.includes(key)),
    );
};

// what an opening's dropdown offers: every size each kind of meld can be
const MELDS = Object.entries(SIZES).flatMap(([type, [lo, hi]]) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => [type, lo + i]),
);
const meldName = ([type, size]) =>
  type === "pair" ? t("Pair") : t(roundName([[type, size]]));

const number = (v) => (v === "" ? null : Number(v));

// the rules the next game starts with; a setting they lack (written by an
// older build, or a game of one just ended) at its default, as a kept
// ruleset's are
const setupOf = (okeyState) => ({
  ...DEFAULTS,
  ...(okeyState.setup ?? CLASSIC),
});

// The lobby: the rules the next game starts with, shared by everyone in the
// room (`setup`) and anyone's to change; picked from the presets and this
// device's, and changed in the settings (⚙).
export function Lobby() {
  const { okeyState, startGame, setSetup } = useContext(OkeyContext);
  const [open, setOpen] = useState(false);
  const setup = setupOf(okeyState);
  const list = allRulesets();
  const base = list.find((r) => r.id === setup.id);
  const changed = base && !isEqual(base, setup);
  const start = () => {
    const no = check(setup);
    if (no) toast(t(no));
    else startGame(setup);
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

// A setting: what it does, and its switch or number; changed from the
// ruleset's (`base`), marked with what it was
function Setting({ field: [key, text, when], setup, base, untested, change }) {
  const changed = base && !isEqual(setup[key], base[key]);
  const set = (v) => change({ [key]: v });
  return (
    <label className={`${when ? "under" : ""} ${changed ? "changed" : ""}`}>
      <span>
        {t(text)}
        {changed && (
          <small className="was">
            {t(`default: ${shownValue(base[key])}`)}
          </small>
        )}
        {untested && (
          <small className="untested">
            {t("Never played this way: it may break mid-game")}
          </small>
        )}
      </span>
      {isSwitch(key) ? (
        <input
          type="checkbox"
          checked={setup[key]}
          onChange={(e) => set(e.target.checked)}
        />
      ) : (
        <input
          type="number"
          placeholder="—"
          value={setup[key] ?? ""}
          onChange={(e) => set(number(e.target.value))}
        />
      )}
    </label>
  );
}

// these groups' settings, as `setup` has them; `change` takes the changed
function Groups({ groups = GROUPS, setup, base, change }) {
  const warn = untested(setup);
  return groups.map(([heading, fields]) => (
    <Fragment key={heading}>
      <h4>{t(heading)}</h4>
      <div className="group">
        {shown(setup, fields).map((f) => (
          <Setting
            key={f[0]}
            field={f}
            setup={setup}
            base={base}
            untested={warn.includes(f[0])}
            change={change}
          />
        ))}
      </div>
    </Fragment>
  ));
}

// Every setting of the rules the next game starts with, to change for that
// game or keep on this device as a ruleset of its own. `base`: the ruleset
// they come from (none when it isn't on this device), to mark what changed
// and go back to.
function Settings({ base, changed, start, onClose }) {
  const { okeyState, setSetup } = useContext(OkeyContext);
  const setup = setupOf(okeyState);
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
    const r = { ...setup, name: trimmed, id: same?.id ?? customNanoid() };
    const no = check(r);
    if (no) return toast(t(no));
    keepRuleset(r);
    setSetup(r);
    toast(t("Saved on this device"));
  };
  const setRound = (i, round) =>
    set({ rounds: setup.rounds.map((r, j) => (j === i ? round : r)) });
  // a points round's points, or its pairs
  const openingField = (i, r, k) => (
    <input
      type="number"
      className={k}
      aria-label={t(k === "points" ? "Opening points" : "Opening pairs")}
      value={r.opening[k] ?? ""}
      onChange={(e) =>
        setRound(i, pointsRound({ ...r.opening, [k]: number(e.target.value) }))
      }
    />
  );
  return (
    <Dialog title={t("Game settings")} className="settings" onClose={onClose}>
      <Groups setup={setup} base={base} change={set} />
      <h4>
        {t("Rounds")}
        {base && !isEqual(base.rounds, setup.rounds) && (
          <small className="was">{t("changed")}</small>
        )}
      </h4>
      <p className="about">{t(ROUNDS)}</p>
      <ul className="rounds">
        {setup.rounds.map((r, i) => (
          <li key={i}>
            <b>{i + 1}.</b>
            <select
              aria-label={t("Opening")}
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

// Mid-game, from the ⋯ menu: the settings the rules read as they're
// played, changed for the whole table from then on. The table's (players,
// tiles, the rack, partners) and the rounds stay as the game was dealt:
// its hands and seats are already laid out by them. A draft, applied at
// once: the rules read every number the moment it's written, an emptied one
// too. Only what was changed here is written, over the rules as they are
// by then. A setting a saved game's rules lack (an older build's) at its
// default, as the lobby's are.
const DEALT = "The table";
export function TableSettings({ onClose }) {
  const { okeyState, setRules, me, setRow } = useContext(OkeyContext);
  const [opened] = useState({ ...DEFAULTS, ...okeyState.rules });
  const [draft, setDraft] = useState(opened);
  // your own rack's rows, apart from the table's rules (null: the table's)
  const mine = okeyState.players.find((p) => p.id === me)?.rowSlots ?? null;
  const [row, setRowDraft] = useState(mine);
  const apply = () => {
    // the rows that don't fit say why (game.setRow), and the dialog stays
    if (row !== mine && !setRow(row)) return;
    const changes = pickBy(draft, (v, k) => !isEqual(v, opened[k]));
    if (isEmpty(changes)) return onClose();
    const rules = { ...DEFAULTS, ...okeyState.rules, ...changes };
    const no = check(rules);
    if (no) return toast(t(no));
    setRules(rules);
    onClose();
  };
  return (
    <Dialog title={t("Rules")} className="settings" onClose={onClose}>
      {me && (
        <>
          <h4>{t("Just for you")}</h4>
          <div className="group">
            <label>
              <span>
                {t("Slots in each row of your own rack; empty: the table's")}
              </span>
              <input
                type="number"
                placeholder={String(okeyState.rules.rowSlots)}
                value={row ?? ""}
                onChange={(e) => setRowDraft(number(e.target.value))}
              />
            </label>
          </div>
        </>
      )}
      <Groups
        groups={GROUPS.filter(([heading]) => heading !== DEALT)}
        setup={draft}
        base={allRulesets().find((r) => r.id === draft.id)}
        change={(change) => setDraft({ ...draft, ...change })}
      />
      <p className="actions">
        <button className="start" onClick={apply}>
          {t("Apply")}
        </button>
      </p>
    </Dialog>
  );
}
