import { useMap } from "@joebobmiles/y-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useAuthStore } from "../../hooks/useStore";
import Board from "./Board";
import { OkeyProvider } from "./OkeyContext";
import "./rack.css";

function Okey(props) {
  return (
    <OkeyProvider {...props}>
      <DndProvider backend={HTML5Backend}>
        <Board />
      </DndProvider>
    </OkeyProvider>
  );
}

export default Okey;
