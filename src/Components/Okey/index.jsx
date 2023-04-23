import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Board from "./Board";
import { OkeyProvider } from "./OkeyContext";
import "./rack.css";

function Okey() {
  return (
    <OkeyProvider>
      <DndProvider backend={HTML5Backend}>
        <Board />
      </DndProvider>
    </OkeyProvider>
  );
}

export default Okey;
