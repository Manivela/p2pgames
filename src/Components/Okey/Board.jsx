import _ from "lodash";
import { Fragment, useContext, useLayoutEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import Rack, { DiscardPile, Hands, Seat } from "./Rack";
import Slot from "./Slot";
import Tile from "./Tile";
import { Melds, RoundInfo, Scores } from "./AmericanoTable";
import "./rack.css";
import { t } from "../../i18n";
import TableMenu from "./TableMenu";
import { AMERICANO, ONE_O_ONE } from "./rulesets";
import { useMoves } from "./moves";

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
// (16.8 tiles across) and for the whole table (7.4 tiles down), up to 70px.
// It's set on the page, so the tiles that fly or are dragged (outside the
// table) and the site's corner buttons (index.css) match.
function useTileSize() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const page = document.documentElement.style;
    const observer = new ResizeObserver(([{ contentRect: box }]) =>
      page.setProperty(
        "--t",
        `${Math.min(box.width / 16.8, box.height / 7.4, 70)}px`,
      ),
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      page.removeProperty("--t");
    };
  }, []);
  return ref;
}

// the draw pile as a stack, its count, and the indicator beside it
function DrawPile() {
  const { okeyState, nextDrawTile, finishGame } = useContext(OkeyContext);
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
        <Tile className="indicator" tile={okeyState.okeyTile} disabled />
      )}
    </div>
  );
}

// the next step: a game to start, the next round, a new game once it's over
// (Reset, and New Game mid-game, live in the table menu)
function NextStep() {
  const { okeyState, startGame, newGame, nextRound } = useContext(OkeyContext);
  switch (okeyState.gameState) {
    case "start":
      return (
        <>
          <button onClick={() => startGame()}>{t("Start Okey")}</button>
          <button onClick={() => startGame(AMERICANO)}>
            {t("Start Americano")}
          </button>
          <button onClick={() => startGame(ONE_O_ONE)}>{t("Start 101")}</button>
        </>
      );
    case "roundEnd":
      return <button onClick={nextRound}>{t("Next Round")}</button>;
    case "finish":
      return <button onClick={newGame}>{t("New Game")}</button>;
    default:
      return null;
  }
}

// what's on the table: the melds, the others' hands once the round ends,
// before a game a way to bring the others
function OnTheTable({ others }) {
  const { okeyState } = useContext(OkeyContext);
  if (okeyState.gameState === "start") {
    return (
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
    );
  }
  if (["roundEnd", "finish"].includes(okeyState.gameState)) {
    return <Hands players={others.map((p) => p.id)} />;
  }
  return okeyState.rules && <Melds />;
}

// One layout for every screen, only the size changes. Across the top: the
// site's buttons (index.css) and the game's at the two ends, the other
// players in seat order between them, each pile between the player who
// throws to it and the one who takes from it. The table: the draw pile on
// the left, where the round stands and the next step on the right. Along
// the bottom: the pile you take from, your rack, the pile you throw to.
function Board() {
  const { okeyState, myIndex } = useContext(OkeyContext);
  // you first, then round the table: right, across, left
  const [mine, ...rest] =
    myIndex !== -1
      ? rotateArray(okeyState.players, myIndex)
      : okeyState.players;
  // left to right: the one before you first
  const others = rest.reverse();
  const fit = useTileSize();
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
            {okeyState.rules && <Scores />}
            <TableMenu />
          </div>
        </div>
        <div className="middle">
          <DrawPile />
          <div className="center">
            <OnTheTable others={others} />
          </div>
          <div className="side">
            <RoundInfo />
            <NextStep />
          </div>
        </div>
        <div className="foot">
          {others[0] && <DiscardPile player={others[0].id} />}
          <Rack player={mine.id} />
          <DiscardPile player={mine.id} />
        </div>
      </div>
    </div>
  );
}

export default Board;
