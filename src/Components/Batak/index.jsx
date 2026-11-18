import { useKey } from "../../hooks/useKey";
import { Table, tell, useTable } from "../Table";
import { Card, Suit } from "../Cards/Card";
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

// The middle of the table: the bid buttons or trumps to name when it's
// yours to, the trick on the table, or the last one taken till the next
// lead, and at the deal's end the next deal's tap
function Middle({ state, table, place }) {
  const { phase, turn, trick, lastTrick } = state;
  const yours = turn !== null && table.mine.includes(turn);
  const act = (next) => table.act(next);
  const next = phase === "over" && table.deal;
  useKey("n", next);
  if (phase === "none") return <p className="bk-note">{table.note}</p>;
  if (yours && phase === "bid") {
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
  const shown = trick.length ? trick : (lastTrick?.cards ?? []);
  const taker = !trick.length && lastTrick?.by;
  return (
    <div className="bk-trick">
      {shown.map(({ seat, card }) => (
        <Card
          key={card}
          card={card}
          className={`at-${place(seat)}${seat === taker ? " took" : ""}`}
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

// the viewer's hand, along the bottom, sorted by suit: a tap plays a card
// when it's their turn, the ones they can't play dimmed
function Hand({ state, table, seat }) {
  const cards = state.hands[seat] ?? [];
  const turn = state.phase === "play" && state.turn === seat;
  const ok = turn ? legal(state, seat) : cards;
  return (
    <div className="bk-hand" style={{ "--n": Math.max(cards.length, 1) }}>
      {cards.map((card) => (
        <Card
          key={card}
          card={card}
          className={turn ? (ok.includes(card) ? "ok" : "no") : ""}
          data-legal={turn && ok.includes(card) ? "" : undefined}
          onClick={() => {
            if (!turn) return;
            const why = whyNot(state, seat, card);
            if (why) tell(why);
            else table.act(play(state, seat, card));
          }}
        />
      ))}
    </div>
  );
}

export default function Batak() {
  const table = useTable("batak", newGame, SIDES, "batak", bot);
  const state = table.game ?? EMPTY;
  // your seat at the bottom, the first seat's for someone watching
  const viewer = table.near;
  const place = (s) => PLACES[(s - viewer + 4) % 4];
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
        <div className="bk-table">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className={`bk-seat ${place(s)}`} data-seat={s}>
              {plate(s)}
            </div>
          ))}
          <div className="bk-middle">
            <Middle state={state} table={table} place={place} />
          </div>
          {table.mine.includes(viewer) && (
            <Hand state={state} table={table} seat={viewer} />
          )}
        </div>
      )}
    </Table>
  );
}
