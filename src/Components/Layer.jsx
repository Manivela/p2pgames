import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./Layer.css";

// A layer over a table (a ready check's plate): it fills the one box the
// table marks `data-middle` (Okey's centre, Batak's trick, the others'
// board), whatever that box holds dimmed and blurred under it, and what it
// holds sized to that box (Layer.css), so it fits every table as it is.
export default function Layer({ children }) {
  const [box, setBox] = useState(null);
  // found as it opens (a layer's drawn only while it's up), the box drawn
  // by then and kept as long as the board is
  useLayoutEffect(() => setBox(document.querySelector("[data-middle]")), []);
  return box && createPortal(<div className="layer">{children}</div>, box);
}
