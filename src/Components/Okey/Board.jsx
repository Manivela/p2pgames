import _ from "lodash";
import { Fragment, useContext, useLayoutEffect, useRef, useState } from "react";
import { OkeyContext } from "./OkeyContext";
import Rack, { DiscardPile, Seat } from "./Rack";
import Slot from "./Slot";
import Tile from "./Tile";
import {
  AmericanoActions,
  AmericanoInfo,
  AmericanoTable,
  Scores,
  place,
} from "./AmericanoTable";
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

// Size of the box the table has to fit in.
function useBoxSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: Infinity, height: Infinity });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize(entry.contentRect),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

// the draw pile as a stack, its count, and the indicator beside it
function DrawPile({ className = "" }) {
  const { okeyState, nextDrawTile, finishGame } = useContext(OkeyContext);
  return (
    <div className={`draw ${className}`}>
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

function GameButtons({ phone }) {
  const { okeyState, startGame, newGame } = useContext(OkeyContext);
  // Reset, and New Game mid-game, live in the table menu; once a game is
  // over, New Game is the obvious next step
  if (!["start", "finish"].includes(okeyState.gameState)) return null;
  return okeyState.gameState === "start" ? (
    <>
      <button
        {...place(phone, { marginLeft: 150 })}
        onClick={() => startGame()}
      >
        {t("Start Okey")}
      </button>
      {/* right under Start Okey, clear of your discard pile */}
      <button
        {...place(phone, { marginLeft: 150, marginTop: 15 })}
        onClick={() => startGame(AMERICANO)}
      >
        {t("Start Americano")}
      </button>
      <button
        {...place(phone, { marginLeft: 150, marginTop: 67 })}
        onClick={() => startGame(ONE_O_ONE)}
      >
        {t("Start 101")}
      </button>
    </>
  ) : (
    <button
      {...place(phone, { marginLeft: 150, marginTop: 0 })}
      onClick={newGame}
    >
      {t("New Game")}
    </button>
  );
}

// Short landscape screens (phones): your rack runs along the bottom and the
// other players shrink to their seat and discard pile, left to right in
// seat order from the one before you.
function PhoneBoard({ players, style }) {
  const { okeyState } = useContext(OkeyContext);
  const americano = !!okeyState.rules;
  const [mine, ...others] = players;
  return (
    <div className="board phone" style={style}>
      <div className="opponents">
        {[...others].reverse().map((player) => (
          <div key={player.id} className="opponent">
            <DiscardPile player={player.id} />
            <Seat player={player.id} />
          </div>
        ))}
      </div>
      <div className="pile">
        <DrawPile />
      </div>
      <div className="table">
        {americano ? (
          <AmericanoInfo />
        ) : (
          <>
            {okeyState.message && (
              <h3 className="round">{t(okeyState.message)}</h3>
            )}
            {/* in a row on the empty table: the column has no room */}
            <div className="buttons">
              <GameButtons phone />
            </div>
          </>
        )}
      </div>
      <div className="actions">
        <TableMenu />
        {americano && <AmericanoActions phone />}
        {americano && (
          <Scores>
            <GameButtons phone />
          </Scores>
        )}
      </div>
      <Rack player={mine.id} />
      <DiscardPile player={mine.id} />
    </div>
  );
}

function Board() {
  const { okeyState, myIndex, me } = useContext(OkeyContext);
  const rotatedPlayers =
    myIndex !== -1
      ? rotateArray(okeyState.players, myIndex)
      : okeyState.players;
  const americano = !!okeyState.rules;
  const two = rotatedPlayers.length === 2;
  const [fitRef, box] = useBoxSize();
  useMoves();
  // short screens: landscape phones
  const phone = window.innerHeight <= 500;
  // smallest sizes where no seats, names or discard piles overlap;
  // Americano needs extra height for the melds above the draw pile
  const width = phone ? 898 : 1160;
  const height = phone ? (americano ? 400 : 330) : americano ? 900 : 740;
  // shrink the fixed-size table to fit, never grow it
  const zoom = Math.min(1, box.width / width, box.height / height);
  return (
    <div
      className="fit"
      ref={fitRef}
      data-rotate={t("Turn your phone sideways to play")}
    >
      {!phone && <TableMenu />}
      {americano && !phone && <Scores />}
      {phone ? (
        <PhoneBoard players={rotatedPlayers} style={{ width, height, zoom }} />
      ) : (
        <div className="board" style={{ width, height, zoom }}>
          {americano && <AmericanoTable />}
          <DrawPile className="drawPile" />
          {okeyState.message && !americano && (
            // left of the draw pile: above it, 2 players' names leave no room
            <h1
              className="drawPile"
              style={{
                marginTop: -20,
                marginLeft: -40,
                transform: "translateX(-100%)",
                width: "max-content",
                maxWidth: 320,
                textAlign: "right",
              }}
            >
              {t(okeyState.message)}
            </h1>
          )}
          <GameButtons />
          {/* you at the bottom, then the others around the table; with two
              players the other one sits across */}
          {rotatedPlayers.map((player, index) => {
            const pos = two ? index * 2 : index;
            return (
              <Fragment key={player.id}>
                {player.id === me ? (
                  <Rack player={me} />
                ) : (
                  <Seat player={player.id} pos={pos} />
                )}
                <DiscardPile player={player.id} pos={pos} />
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Board;
