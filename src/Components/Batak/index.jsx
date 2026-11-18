import { useLayoutEffect, useRef, useState } from "react";
import { useKey } from "../../hooks/useKey";
import { Table, tell, useChangedAt, useHeard, useTable } from "../Table";
import { Card, Suit } from "../Cards/Card";
import { useCardSounds } from "../Cards/sounds";
import { dealCards } from "../Cards/deal";
import { t } from "../../i18n";
import bot from "./bot";
import { bid, bidsOpen, legal, newGame, play, trump, whyNot } from "./rules";
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

// a new deal: the deck shuffled in the middle this long before it's dealt
const SHUFFLE_MS = 700;

// a trick taken lies 1 s, for everyone to see what was played, then
// slides to its taker (batak.css); a bot leads once it's gone (bot.js)
const GATHER_MS = 1000;

// The middle of the table: the bid buttons or trumps to name when it's
// yours to, the trick on the table, and at the deal's end the next deal's
// tap. A card played comes from its player; a trick taken lies 1 s,
// its taking card lit, then slides to its taker: only as this page sees it
// happen, so a page that comes later finds the felt bare.
function Middle({ state, table, place, dealing, from }) {
  const { phase, turn, trick, lastTrick, last } = state;
  const yours = turn !== null && table.mine.includes(turn);
  const act = (next) => table.act(next);
  const next = phase === "over" && table.deal;
  useKey("n", next);
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
      {next && (
        <button className="bk-next" aria-label={t("Next game")} onClick={next}>
          {t("Next game")}
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
  const table = useTable("batak", newGame, SIDES, "batak", bot);
  const state = table.game ?? EMPTY;
  // everyone hears a card put down, a trick slid to its taker; a new
  // sound level puts a card down
  const sounds = useCardSounds();
  // the trick slid only if nothing's been played since: a lead clears it
  const lastN = useRef(null);
  lastN.current = table.game?.last.n;
  useHeard(
    table.game?.last,
    ({ kind, n }) => {
      if (kind === "play" || kind === "trick") sounds.put();
      if (kind !== "trick") return;
      setTimeout(() => lastN.current === n && sounds.slide(), GATHER_MS);
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
  const dealtAt = useChangedAt(table.game?.id, table.live);
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
