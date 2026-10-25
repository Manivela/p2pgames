import _ from "lodash";
import { Fragment, useContext, useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useDrop } from "react-dnd";
import { OkeyContext } from "./OkeyContext";
import Rack, { DiscardPile, Seat } from "./Rack";
import Slot from "./Slot";
import Tile from "./Tile";
import { LastTurn, Melds, RoundInfo, Scores } from "./AmericanoTable";
import "./rack.css";
import { t } from "../../i18n";
import TableMenu from "./TableMenu";
import { AMERICANO, ONE_O_ONE } from "./rulesets";
import { useMoves } from "./moves";
import { pileOut, rowOf } from "./game";

function rotateArray(array, x) {
  // Normalize the rotation count
  const rotations = x % array.length;

  // Handle negative rotations
  const normalizedRotations =
    rotations >= 0 ? rotations : array.length + rotations;

  // Handle rotation count of 1 separately
  if (normalizedRotations === 1) {
    return _.concat(_.tail(array), _.head(array));
  }

  // Split the array into two parts based on the rotation count
  const [head, tail] = _.chunk(array, normalizedRotations);

  // If either head or tail is undefined, return the original array
  if (head === undefined || tail === undefined) {
    return array;
  }

  // Rearrange the array by concatenating the tail with the head
  return _.concat(tail, head);
}

// The table is laid out in tile widths: --t, the width of a tile in your
// rack, is as big as the box allows for the rack and the piles beside it
// (`across`: a rack row and 3.8 more) and for the whole table (7.4 tiles
// down), up to 70px.
// It's set on the page, so the tiles that fly or are dragged (outside the
// table) and the site's corner buttons (index.css) match.
function useTileSize(across) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const page = document.documentElement.style;
    const observer = new ResizeObserver(([{ contentRect: box }]) =>
      page.setProperty(
        "--t",
        `${Math.min(box.width / across, box.height / 7.4, 70)}px`,
      ),
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      page.removeProperty("--t");
    };
  }, [across]);
  return ref;
}

// The draw pile sits in the middle of a table with room for it and a
// couple of rows of melds (3.5 tiles tall: desktops and tablets, not
// phones), until what's on the table needs the room: the melds would have
// to shrink, or the invite doesn't fit beside it. Then it moves to the
// left, where phones keep it, until the next deal.
function usePileAside(deal) {
  const ref = useRef(null);
  const [small, setSmall] = useState(false);
  // the deal whose table filled up
  const [fullIn, setFullIn] = useState(null);
  const aside = small || fullIn === deal;
  useLayoutEffect(() => {
    const table = ref.current;
    const check = () => {
      const t = parseFloat(
        document.documentElement.style.getPropertyValue("--t"),
      );
      setSmall(table.clientHeight < 3.5 * t);
      if (aside) return;
      // the melds' scale (AmericanoTable.jsx), 1 while they fit as they are
      const fit = table
        .querySelector(".melds")
        ?.style.getPropertyValue("--fit");
      if (Number(fit || 1) < 1 || table.scrollHeight > table.clientHeight) {
        setFullIn(deal);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(table);
    return () => observer.disconnect();
  });
  return [ref, aside];
}

// the draw pile as a stack, its count, and the indicator beside it (101's
// gösterge: its twin dropped on it)
function DrawPile() {
  const { okeyState, nextDrawTile, finishGame, showIndicator } =
    useContext(OkeyContext);
  const [, show] = useDrop(
    () => ({ accept: "TILE", drop: (e) => void showIndicator(e.tile) }),
    [showIndicator],
  );
  return (
    <div className="draw">
      <Slot
        className="stack"
        showBorder
        tile={nextDrawTile}
        type="DRAW"
        onDrop={finishGame}
      />
      <span className="count">{okeyState.drawPile.length}</span>
      {okeyState.okeyTile && (
        <div ref={show} className="twin">
          <Tile className="indicator" tile={okeyState.okeyTile} disabled />
        </div>
      )}
      {/* the tile someone finished with */}
      {okeyState.finishTile && (
        <Tile className="thrown" tile={okeyState.finishTile} disabled />
      )}
    </div>
  );
}

// the next step: a game to start, a new pile once it runs out (classic),
// the next round, a new game once it's over (Reset, New Game mid-game and
// ending a game whose pile ran out live in the table menu)
function NextStep() {
  const {
    okeyState,
    me,
    startGame,
    newGame,
    nextRound,
    shuffleDiscards,
    selected,
    picking,
    startPicking,
    openHand,
    openAll,
    layMelds,
  } = useContext(OkeyContext);
  // 101's options: four in pairs, doubling (katlamalı)
  const [partners, setPartners] = useState(false);
  const [doubling, setDoubling] = useState(false);
  const option = (label, on, set) => (
    <label>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
      />
      {t(label)}
    </label>
  );
  switch (okeyState.gameState) {
    case "start":
      return (
        <>
          <button onClick={() => startGame()}>{t("Start Okey")}</button>
          <button onClick={() => startGame(AMERICANO)}>
            {t("Start Americano")}
          </button>
          <button
            onClick={() => startGame({ ...ONE_O_ONE, partners, doubling })}
          >
            {t("Start 101")}
          </button>
          <span className="options">
            {option("Partners", partners, setPartners)}
            {option("Doubling", doubling, setDoubling)}
          </span>
        </>
      );
    case "play": {
      if (!okeyState.rules) {
        return (
          pileOut(okeyState, me) && (
            <button onClick={shuffleDiscards}>
              {t("Shuffle and play on")}
            </button>
          )
        );
      }
      // El aç, all hand long: pressed once, it picks what it would lay down
      // (the opening, then the sets and runs on your rack; pairs only by
      // hand) and a tap on your rack picks a whole group; pressed again, it
      // lays the picked tiles or, none picked, the opening it finds
      const opened = okeyState.opened[me];
      const lay = opened ? layMelds : openHand;
      return (
        me &&
        okeyState.rules.rounds[okeyState.round - 1].melds !== null && (
          <button
            aria-pressed={picking}
            onClick={
              !picking
                ? startPicking
                : selected.length || opened
                  ? lay
                  : openAll
            }
          >
            {t(
              !picking
                ? opened
                  ? "Lay melds"
                  : "Open your hand"
                : selected.length
                  ? "Open picked"
                  : opened
                    ? "Lay melds"
                    : "Find and open",
            )}
          </button>
        )
      );
    }
    case "roundEnd":
      return <button onClick={nextRound}>{t("Next Round")}</button>;
    case "finish":
      return <button onClick={newGame}>{t("New Game")}</button>;
    default:
      return null;
  }
}

// a newer version out (OkeyContext): reload for it
function NewVersion() {
  const { newVersion } = useContext(OkeyContext);
  return (
    newVersion && (
      <button className="update" onClick={() => location.reload()}>
        ↻ {t("New version")}
      </button>
    )
  );
}

// what's on the table: the melds (left as they are when the round ends),
// before a game a way to bring the others; and the draw pile, while it's
// in the middle
function OnTheTable({ pile }) {
  const { okeyState } = useContext(OkeyContext);
  if (okeyState.gameState === "start") {
    return (
      <>
        {pile}
        <button
          onClick={() =>
            navigator.clipboard
              ?.writeText(window.location.href)
              .then(() => toast.success(t("Copied!")))
              .catch(() => toast(t("Couldn't copy")))
          }
        >
          {t("Copy invite link")}
        </button>
      </>
    );
  }
  return (
    <>
      {pile}
      {okeyState.rules && <Melds underPile={!!pile} />}
    </>
  );
}

// One layout for every screen, only the size changes. Across the top: the
// site's buttons (index.css) and the game's at the two ends, the other
// players in seat order between them, each pile between the player who
// throws to it and the one who takes from it. The table: the draw pile in
// the middle or, once the table fills, on the left (usePileAside); where
// the round stands (once it's over, how it finished) and the next step on
// the right. Along the bottom: the pile you take from, your rack (every
// hand once the round ends), the pile you throw to.
function Board() {
  const { okeyState, myIndex } = useContext(OkeyContext);
  // you first, then round the table: right, across, left
  const [mine, ...rest] =
    myIndex !== -1
      ? rotateArray(okeyState.players, myIndex)
      : okeyState.players;
  // left to right: the one before you first
  const others = rest.reverse();
  const fit = useTileSize(rowOf(okeyState) + 3.8);
  const [table, pileAside] = usePileAside(okeyState.deal);
  useMoves();
  return (
    <div
      className="fit"
      ref={fit}
      data-rotate={t("Turn your phone sideways to play")}
    >
      <div className="board">
        <div className="head">
          <div className="end" />
          <div className="others">
            {others.map((player, i) => (
              <Fragment key={player.id}>
                <Seat player={player.id} />
                {/* the next one along throws to this one */}
                {others[i + 1] && (
                  <DiscardPile player={others[i + 1].id} small />
                )}
              </Fragment>
            ))}
          </div>
          <div className="end">
            <NewVersion />
            {okeyState.rules && <Scores />}
            <TableMenu />
          </div>
        </div>
        <div className="middle">
          {pileAside && <DrawPile />}
          <div className="center" ref={table}>
            <OnTheTable pile={!pileAside && <DrawPile />} />
          </div>
          <div className="side">
            <RoundInfo />
            <LastTurn />
            <NextStep />
          </div>
        </div>
        <div className="foot">
          {others[0] && <DiscardPile player={others[0].id} />}
          <Rack player={mine.id} hands={[mine, ...others].map((p) => p.id)} />
          <DiscardPile player={mine.id} />
        </div>
      </div>
    </div>
  );
}

export default Board;
