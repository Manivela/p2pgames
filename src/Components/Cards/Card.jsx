import { SUITS, rankName, red, suitOf } from "./cards";
import "./cards.css";

// A card face up, its rank in the corner and its suit large; a button when
// it can be played (`onClick`). Sized by the table: --cw, its width.
export function Card({ card, className = "", ...props }) {
  const Tag = props.onClick ? "button" : "span";
  return (
    <Tag
      className={`cd-card${red(card) ? " red" : ""} ${className}`}
      data-card={card}
      data-suit={SUITS[suitOf(card)]}
      aria-label={`${rankName(card)}${SUITS[suitOf(card)]}`}
      {...props}
    >
      <b>{rankName(card)}</b>
      <i>{SUITS[suitOf(card)]}</i>
    </Tag>
  );
}

// a suit's sign in its colour
export const Suit = ({ suit }) => (
  <i className={`cd-suit${suit % 2 ? " red" : ""}`}>{SUITS[suit]}</i>
);
