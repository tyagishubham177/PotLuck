import { memo } from "react";

const suitSymbols: Record<string, string> = {
  C: "clubs",
  D: "diamonds",
  H: "hearts",
  S: "spades"
};

const suitGlyphs: Record<string, string> = {
  C: "\u2663",
  D: "\u2666",
  H: "\u2665",
  S: "\u2660"
};

type CardFaceProps = {
  card?: string;
  hidden?: boolean;
  winning?: boolean;
};

function CardFaceComponent({ card, hidden = false, winning = false }: CardFaceProps) {
  if (hidden || !card) {
    return (
      <div className="playing-card hidden" aria-hidden="true">
        <span className="card-back-pattern" />
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = suit === "D" || suit === "H";

  return (
    <div
      aria-label={`${rank} of ${suitSymbols[suit] ?? suit.toLowerCase()}`}
      className={`playing-card reveal-card${isRed ? " suit-red" : ""}${winning ? " is-winning" : ""}`}
      role="img"
    >
      <span className="card-rank">{rank}</span>
      <span className="card-suit">{suitGlyphs[suit] ?? suit}</span>
    </div>
  );
}

export const CardFace = memo(CardFaceComponent);
