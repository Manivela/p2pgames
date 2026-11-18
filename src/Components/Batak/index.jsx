import { useLayoutEffect, useRef, useState } from "react";
import { useKey } from "../../hooks/useKey";
import {
  Table,
  tell,
  useChangedAt,
  useClap,
  useHeard,
  useTable,
} from "../Table";
import { Card, Suit } from "../Cards/Card";
import { useCardSounds } from "../Cards/sounds";
import { dealCards } from "../Cards/deal";
import { t } from "../../i18n";
import bot from "./bot";
import {
  DEALS,
  bid,
  bidsOpen,
  dealNext,
  legal,
  newGame,
  play,
  trump,
  whyNot,
} from "./rules";
import "./batak.css";

// The room's Batak table (Table: its own Yjs map, the four seats, ⋯), the
// rules' state in rules.js. Each page sits its own seat at the bottom, the
// next to play on its right, as round a real table (`next`, rules.js);
// someone watching sits the first seat's. A hand shows only to its player:
// everyone's is in the room's state, as at the Okey table.
const SIDES = ["South", "East", "North", "West"];
// where a seat sits from the viewer's: theirs, the next, across, the last
const PLACES = ["me", "right", "top", "left"];

// before a deal: no cards, no one's turn
const EMPTY = {
  phase: "none",
  hands: [[], [], [], []],
  bids: [null, null, null, null],
  trick: [],
  lastTrick: null,
  taken: [0, 0, 0, 0],
  turn: null,
};

// What's said by a seat's name: its bid while bidding, then its tricks
// (the bidder's against the contract), and at the end what the deal was
// worth to it
function info(state, s) {
  const { phase, bids, bidder, contract, taken, points } = state;
  if (phase === "bid") {
    if (bids[s] === null) return null;
    return { value: bids[s] ? String(bids[s]) : t("Pass"), title: t("Bid") };
  }
  if (phase === "over") {
    const p = points[s];
    return { value: p > 0 ? `+${p}` : String(p), title: t("This deal") };
  }
  if (phase === "none") return null;
  return s === bidder
    ? { value: `${taken[s]}/${contract}`, title: t("Tricks taken, of the bid") }
    : { value: String(taken[s]), title: t("Tricks taken") };
}

// The match's score sheet: a row a deal, each seat's points, the bidder's
// with their trumps; the deal being played, its bidder's bid so far, and
// those to come, blank; the most points leading
function sheetOf(state) {
  const { rows, deals, score, phase, bidder, contract, trump } = state;
  const running = phase === "over" ? -1 : rows.length;
  return {
    rows: Array.from({ length: deals }, (_, i) => {
      const r = rows[i];
      const bid = (s) =>
        i === running && s === bidder && trump !== null ? (
          <>
            <Suit suit={trump} /> {contract}
          </>
        ) : (
          ""
        );
      return {
        key: i,
        label: i + 1,
        className: r ? "" : i === running ? "running" : "later",
        cells: [0, 1, 2, 3].map((s) =>
          r ? (
            <>
              {s === r.bidder && <Suit suit={r.trump} />} {r.points[s]}
            </>
          ) : (
            bid(s)
          ),
        ),
      };
    }),
    lead: score.some((v) => v !== score[0]) && Math.max(...score),
  };
}

// a new deal: the deck shuffled in the middle this long before it's dealt
const SHUFFLE_MS = 700;

// a trick taken lies 1 s, for everyone to see what was played, then
// slides to its taker (batak.css); a bot leads once it's gone (bot.js)
const GATHER_MS = 1000;

// The middle of the table: the bid buttons or trumps to name when it's
// yours to, the trick on the table, at a deal's end the next deal's tap
// for its dealer, and at the match's end who won it and a new one's tap
// for its players. A card played comes from its player; a trick taken
// lies 1 s,
// its taking card lit, then slides to its taker: only as this page sees it
// happen, so a page that comes later finds the felt bare.
function Middle({ state, table, place, dealing, from }) {
  const { phase, turn, trick, lastTrick, last } = state;
  const yours = turn !== null && table.mine.includes(turn);
  const act = (next) => table.act(next);
  // the next deal: its dealer's tap, or while the room waits for everyone,
  // each player's (Table's useTable deals once all have)
  const deal =
    phase === "over" &&
    turn !== null &&
    (table.waits ? table.deal : yours && (() => act(dealNext(state, turn))));
  const next = phase === "over" && turn === null && table.deal;
  // a full table waits for a player's Start
  const start = phase === "none" && table.start;
  useKey("n", deal || next || start);
  const won = phase === "over" && turn === null && state.winners;
  const nameOf = (s) =>
    table.seats[s]?.bot ? table.seats[s].name : table.names[s];
  const seen = useChangedAt(last?.n, table.live) > 0;
  // a card you played flies from where it sat in your hand (Hand's
  // `from`), not in from below as the others' come from their seats
  const box = useRef(null);
  useLayoutEffect(() => {
    const was = from.current;
    if (!was || was.flown || was.card !== last?.card) return;
    was.flown = true;
    const el = box.current?.querySelector(`[data-card="${was.card}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const by = `translate(${was.x - r.left}px, ${was.y - r.top}px)`;
    el.animate([{ transform: by }, {}], { duration: 250, easing: "ease-out" });
  }, [last?.n, last?.card, from]);
  if (start) {
    return (
      <button className="bk-next start" aria-label={t("Start")} onClick={start}>
        {t("Start")}
        <kbd>N</kbd>
      </button>
    );
  }
  if (phase === "none") return <p className="bk-note">{table.note}</p>;
  // the bids once the cards are dealt (Cards/deal.js)
  if (yours && phase === "bid" && !dealing) {
    return (
      <div className="bk-bids" role="group" aria-label={t("Bid")}>
        {bidsOpen(state).map((n) => (
          <button key={n} onClick={() => act(bid(state, turn, n))}>
            {n ? n : t("Pass")}
          </button>
        ))}
      </div>
    );
  }
  if (yours && phase === "trump") {
    return (
      <div className="bk-bids suits" role="group" aria-label={t("Trumps")}>
        {[0, 1, 2, 3].map((s) => (
          <button key={s} onClick={() => act(trump(state, turn, s))}>
            <Suit suit={s} />
          </button>
        ))}
      </div>
    );
  }
  const taken = !trick.length && seen && lastTrick;
  const shown = trick.length ? trick : taken ? lastTrick.cards : [];
  const put = seen && (last.kind === "play" || last.kind === "trick");
  return (
    <div className="bk-trick" data-felt="" ref={box}>
      {shown.map(({ seat, card }) => (
        <Card
          key={card}
          card={card}
          className={[
            `at-${place(seat)}`,
            put && card === last.card && from.current?.card !== card && "in",
            taken && seat === taken.by && "took",
            taken && `gather to-${place(taken.by)}`,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
      {won && (
        <p className="bk-won">{t(`${won.map(nameOf).join(" & ")} wins!`)}</p>
      )}
      {(deal || next) && (
        <button
          className="bk-next"
          aria-label={t(deal ? "Deal" : "Next game")}
          aria-pressed={table.waits ? table.pressed : undefined}
          onClick={deal || next}
        >
          {t(deal ? "Deal" : "Next game")}
          <kbd>N</kbd>
        </button>
      )}
    </div>
  );
}

// a card you can play's key: 1 to 9, then 0, along the hand
const KEYS = "1234567890";
function CardKey({ k, press }) {
  useKey(k, press);
  return <kbd>{k}</kbd>;
}

// the viewer's hand, along the bottom, sorted by suit: a tap plays a card
// when it's their turn, the ones they can't play dimmed, the ones they can
// a number key each (KEYS)
function Hand({ state, table, seat, from }) {
  const cards = state.hands[seat] ?? [];
  const turn = state.phase === "play" && state.turn === seat;
  const ok = turn ? legal(state, seat) : cards;
  const playable = turn ? cards.filter((c) => ok.includes(c)) : [];
  const hand = useRef(null);
  const tap = (card) => {
    if (!turn) return;
    const why = whyNot(state, seat, card);
    if (why) return tell(why);
    // where it was, for it to fly from to the trick (Middle)
    const r = hand.current
      ?.querySelector(`[data-card="${card}"]`)
      ?.getBoundingClientRect();
    from.current = r && { card, x: r.left, y: r.top };
    table.act(play(state, seat, card));
  };
  return (
    <div
      className="bk-hand"
      style={{ "--n": Math.max(cards.length, 1) }}
      ref={hand}
    >
      {cards.map((card) => {
        const k = KEYS[playable.indexOf(card)];
        return (
          <Card
            key={card}
            card={card}
            className={turn ? (ok.includes(card) ? "ok" : "no") : ""}
            data-legal={turn && ok.includes(card) ? "" : undefined}
            onClick={() => tap(card)}
          >
            {k && <CardKey k={k} press={() => tap(card)} />}
          </Card>
        );
      })}
    </div>
  );
}

export default function Batak() {
  // the mode: how many deals a match is
  const table = useTable("batak", newGame, SIDES, "8", bot, {
    hand: {
      over: (s) => s.phase === "over" && s.turn !== null,
      next: (s) => dealNext(s, s.turn),
    },
    lobby: true,
  });
  const state = table.game ?? EMPTY;
  // everyone hears a card put down, a trick slid to its taker, and a
  // short clap for a bid made at a deal's end (the match's own applause
  // at its end, Table); a new sound level puts a card down
  const sounds = useCardSounds();
  const clap = useClap();
  // the trick slid only if nothing's been played since: a lead clears it
  const now = useRef(null);
  now.current = table.game;
  useHeard(
    table.game?.last,
    ({ kind, n }) => {
      if (kind === "play" || kind === "trick") sounds.put();
      if (kind !== "trick") return;
      setTimeout(() => now.current?.last.n === n && sounds.slide(), GATHER_MS);
      const g = now.current;
      const row = g?.phase === "over" && g.turn !== null && g.rows?.at(-1);
      if (row && row.points[row.bidder] > 0) clap();
    },
    sounds.put,
  );
  // your seat at the bottom, the first seat's for someone watching
  const viewer = table.near;
  const place = (s) => PLACES[(s - viewer + 4) % 4];
  // a new deal seen dealt: the deck shuffled in the middle, then dealt
  // round from the dealer's left, a card at a time (Cards/deal.js)
  const board = useRef(null);
  // where the card you just played was in your hand (Hand, Middle)
  const from = useRef(null);
  const g = table.game;
  const dealtAt = useChangedAt(g && `${g.id}/${g.round}`, table.live);
  const [dealing, setDealing] = useState(false);
  useLayoutEffect(() => {
    const g = table.game;
    const el = board.current;
    if (!dealtAt || g?.last.kind !== "new" || !el) return;
    const order = [1, 2, 3, 4].map((k) => (g.dealer + k) % 4);
    const hands = order.map((s) =>
      s === viewer && table.mine.includes(s)
        ? { cards: [...el.querySelectorAll(".bk-hand .cd-card")] }
        : {
            seat: el.querySelector(`[data-seat="${s}"] .tb-plate`),
            count: g.hands[s].length,
          },
    );
    sounds.shuffle();
    const ms = dealCards(el, el.querySelector(".bk-middle"), hands, {
      wait: SHUFFLE_MS,
      onCard: sounds.deal,
    });
    if (!ms) return;
    setDealing(true);
    const timer = setTimeout(() => setDealing(false), ms);
    return () => clearTimeout(timer);
  }, [dealtAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Table
      table={table}
      // the bidder's trumps by their name, once named
      mark={(s) =>
        s === state.bidder && state.trump !== null ? (
          <Suit suit={state.trump} />
        ) : null
      }
      info={(s) => info(state, s)}
      // the match's length, before it starts (Go's board size, as well),
      // everyone's
      everyone={
        table.setMode && (
          <label>
            <span>{t("Deals")}</span>
            <select
              value={DEALS.includes(Number(table.mode)) ? table.mode : "8"}
              onChange={(e) => table.setMode(e.target.value)}
            >
              {DEALS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )
      }
      sheet={g?.rows && sheetOf(g)}
    >
      {(plate) => (
        // the felt, bare between the cards, knocks (Table)
        <div className="bk-table" data-felt="" ref={board}>
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`bk-seat ${place(s)}`}
              data-seat={s}
              data-felt=""
            >
              {plate(s)}
            </div>
          ))}
          <div className="bk-middle" data-felt="">
            <Middle
              state={state}
              table={table}
              place={place}
              dealing={dealing}
              from={from}
            />
          </div>
          {table.mine.includes(viewer) && (
            <Hand state={state} table={table} seat={viewer} from={from} />
          )}
        </div>
      )}
    </Table>
  );
}
