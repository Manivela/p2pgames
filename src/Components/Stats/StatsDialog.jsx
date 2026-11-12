import { useEffect, useRef, useState } from "react";
import { countBy, groupBy, maxBy, sortBy, sumBy } from "lodash";
import { toast } from "react-hot-toast";
import { Dialog } from "../Saves";
import { t } from "../../i18n";
import { TITLES, identities } from "./history";
import { exportAll, importAll, summaries, useKeepAll } from "./store";
import "./stats.css";

// who does each most at the Okey table, as it's said
const OKEY = [
  ["took", "Takes the discard most"],
  ["fed", "Feeds the table most"],
  ["claimed", "Claims the most discards"],
  ["caught", "Catches the most tiles"],
  ["dropped", "Gets caught most"],
  ["finished", "Finishes the most rounds"],
  ["first", "Opens first most"],
  ["wrong", "Calls wrongly most"],
];
// the Okey games someone needs with you before they can lead at anything
// ponytail: one bar for every count; lower it if the lines stay empty too long
const LEAD_GAMES = 3;

const avg = (n, games) =>
  (n / games).toLocaleString(undefined, { maximumFractionDigits: 1 });

function duration(ms) {
  const m = Math.round(ms / 60000);
  return t(m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
}

// the most common of `values` (by `key`), or undefined
const most = (values) =>
  maxBy(Object.entries(countBy(values)), ([, n]) => n)?.[0];

// you in a game: who recorded it, under any of their ids there (a laptop,
// then a phone); with a result unless they played both sides
const isYou = (s, p) => p.ids.includes(s.me);
const you = (s) => s.players.find((p) => isYou(s, p));

// Your stats, worked out as they open from every game recorded on this
// device (store.js): how your games went, the people you play with (who
// does what most at the Okey table) and each game's own; and
// the record taken to another device as a file (Export), or brought from
// one (Import). `plays`: the ways to play (Menu.jsx), for the games' names.
export default function StatsDialog({ plays, onClose }) {
  const [all, setAll] = useState();
  const file = useRef(null);
  const keepAll = useKeepAll((s) => s.all);
  const setKeepAll = useKeepAll((s) => s.setAll);
  const load = () =>
    summaries()
      .then(setAll)
      // the browser keeps this site from storing anything
      .catch(() => setAll(null));
  useEffect(() => {
    load();
  }, []);

  const label = (s) => {
    const p =
      plays.find((p) => p.game === s.kind && p.mode === s.mode) ??
      plays.find((p) => p.game === s.kind);
    if (!p) return s.kind;
    return p.mode === s.mode
      ? [p.name, p.kind].filter(Boolean).join(" ")
      : p.name;
  };

  const save = async () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(await exportAll())], {
        type: "application/json",
      }),
    );
    Object.assign(document.createElement("a"), {
      href: url,
      download: `p2pgames-stats-${new Date().toISOString().slice(0, 10)}.json`,
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const bring = async (file) => {
    let added = null;
    try {
      added = await importAll(JSON.parse(await file.text()));
    } catch {
      // not JSON, or not ours
    }
    toast(
      added === null
        ? t("That's not a stats file")
        : t(`Games added: ${added}`),
    );
    load();
  };

  return (
    <Dialog title={t("Your stats")} className="stats" onClose={onClose}>
      {all === null && (
        <p>
          {t(
            "This browser isn't keeping data for this site, so no stats are kept.",
          )}
        </p>
      )}
      {all?.length === 0 && (
        <p>
          {t(
            "No games yet: a game is counted here once it's played to the end.",
          )}
        </p>
      )}
      {all?.length > 0 && <Stats all={all} label={label} />}
      {all !== null && (
        <>
          <label className="keep">
            <input
              type="checkbox"
              checked={keepAll}
              onChange={(e) => setKeepAll(e.target.checked)}
            />{" "}
            {t("Keep every game's recording on this device")}
          </label>
          <small className="keep">
            {t(
              "Other devices get the last 100 games' recordings, and every game's stats",
            )}
          </small>
          <p className="io">
            <button onClick={save}>{t("Export")}</button>{" "}
            <button onClick={() => file.current.click()}>{t("Import")}</button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              // Bootstrap shows file inputs, hidden or not
              style={{ display: "none" }}
              onChange={(e) => {
                const [chosen] = e.target.files;
                e.target.value = ""; // the same file again is a change too
                if (chosen) bring(chosen);
              }}
            />
          </p>
        </>
      )}
    </Dialog>
  );
}

function Stats({ all, label }) {
  const games = sortBy(
    all.filter((s) => you(s)?.result),
    "end",
  );
  const results = games.map((s) => you(s).result);
  const who = identities(all);
  const count = countBy(results);
  let run = 0;
  let best = 0;
  for (const r of results) {
    run = r === "won" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const decided = results.length;

  // everyone you've played with, but the bots: games together, and how
  // often each won when you lost, and lost when you won
  const people = {};
  for (const s of games) {
    const me = you(s);
    for (const p of s.players) {
      if (p.bot || isYou(s, p)) continue;
      const x = (people[who(p)] ??= {
        name: p.name,
        games: 0,
        beat: 0,
        beaten: 0,
      });
      x.name = p.name ?? x.name;
      x.games++;
      if (p.result === "won" && me.result === "lost") x.beat++;
      if (p.result === "lost" && me.result === "won") x.beaten++;
    }
  }
  const list = Object.values(people);
  const top = (key) => {
    const p = maxBy(list, key);
    return p?.[key] > 0 ? `${p.name ?? "?"} (${p[key]})` : null;
  };
  const botGames = games.filter((s) =>
    s.players.every((p) => isYou(s, p) || p.bot),
  );
  const bots = countBy(botGames, (s) => you(s).result);
  const hour = most(all.map((s) => new Date(s.start).getHours()));

  const overall = [
    ["Games", all.length],
    ["Won", count.won ?? 0],
    ["Lost", count.lost ?? 0],
    ["Drawn", count.drawn],
    [
      "Win rate",
      decided ? `${Math.round((100 * (count.won ?? 0)) / decided)}%` : null,
    ],
    ["Best streak", best],
    ["Current streak", run],
    ["Time played", duration(sumBy(all, "ms"))],
    ["Favourite game", most(all.map(label))],
    ["Usually at", `${String(hour).padStart(2, "0")}:00`],
    [
      "Playing since",
      new Date(Math.min(...all.map((s) => s.start))).toLocaleDateString(),
    ],
    ["Most played with", top("games")],
    ["Nemesis", top("beat")],
    ["Favourite victim", top("beaten")],
    [
      "Against bots",
      botGames.length ? `${bots.won ?? 0}–${bots.lost ?? 0}` : null,
    ],
  ];

  // at the Okey table: who does each most, a game on average, of everyone
  // in LEAD_GAMES of your Okey games or more (you as one on every device,
  // the bots left out)
  const okey = all.filter((s) => s.kind === "okey");
  const seats = {};
  for (const s of okey) {
    for (const p of s.players) {
      if (p.bot) continue;
      const key = isYou(s, p) ? "you" : who(p);
      const x = (seats[key] ??= { games: 0, you: key === "you" });
      x.name = p.name ?? x.name;
      x.games++;
      for (const [k] of OKEY) x[k] = (x[k] ?? 0) + Math.max(p[k] ?? 0, 0);
    }
  }
  const regulars = Object.values(seats).filter((x) => x.games >= LEAD_GAMES);
  const leaders = OKEY.map(([k, said]) => {
    const x = maxBy(regulars, (x) => x[k] / x.games);
    if (!x?.[k]) return [said, null];
    const name = x.you ? `${x.name} (${t("you")})` : (x.name ?? "?");
    return [said, t(`${name}, ${avg(x[k], x.games)} a game`)];
  });

  // each game's own: how it went for you, and what it alone counts
  const byGame = Object.entries(groupBy(all, label));
  const mine = (list, key) => sumBy(list, (s) => you(s)?.[key] ?? 0);
  const extras = (list) => {
    const kind = list[0].kind;
    if (kind === "okey") {
      const titles = list.map((s) => you(s)?.title).filter(Boolean);
      return [
        ["Rounds finished", mine(list, "finished")],
        [
          "Titles won",
          Object.entries(countBy(titles))
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${t(TITLES[k])} ×${n}`)
            .join(", "),
        ],
      ];
    }
    // backgammon's table, but not the checkers on the back of its case
    if (kind === "backgammon" && !["checkers", "dama"].includes(list[0].mode)) {
      return [
        ["Doubles", `${mine(list, "doubles")} / ${mine(list, "rolls")}`],
        ["Hits", mine(list, "hits")],
        [
          "Mars wins",
          list.filter((s) => s.mars && you(s)?.result === "won").length,
        ],
      ];
    }
    if (kind === "go") return [["Stones taken", mine(list, "taken")]];
    return [];
  };

  return (
    <>
      <h4>{t("Overall")}</h4>
      <List rows={overall} />
      {leaders.some(([, value]) => value) && (
        <>
          <h4>{t("At the Okey table")}</h4>
          <List rows={leaders} wide />
        </>
      )}
      {sortBy(byGame, ([, list]) => -list.length).map(([name, list]) => {
        const c = countBy(list, (s) => you(s)?.result);
        return (
          <section key={name}>
            <h4>{name}</h4>
            <List
              rows={[
                ["Games", list.length],
                ["Won", c.won ?? 0],
                ["Lost", c.lost ?? 0],
                ["Drawn", c.drawn],
                ["Time played", duration(sumBy(list, "ms"))],
                ...extras(list),
              ]}
            />
          </section>
        );
      })}
    </>
  );
}

// label and value, each row with one (none with nothing to say), two to
// a line where they fit, or one (`wide`: a name and a number each)
function List({ rows, wide }) {
  return (
    <dl className={wide ? "wide" : undefined}>
      {rows
        .filter(([, value]) => value || value === 0)
        .map(([name, value]) => (
          <div key={name}>
            <dt>{t(name)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
