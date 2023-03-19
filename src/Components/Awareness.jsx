import React from "react";
import { useParams } from "react-router-dom";
import { useWebRtc, useAwareness } from "@joebobmiles/y-react";
import { useAuthStore } from "../hooks/useStore";

export default function Awareness() {
  const { roomId } = useParams();

  const provider = useWebRtc(roomId);
  const { states, localID, setLocalState } = useAwareness(provider.awareness);
  const [currentUser] = useAuthStore((state) => [state.currentUser]);

  React.useEffect(() => {
    setLocalState((prevState) => ({
      ...prevState,
      user: currentUser,
    }));
    window.addEventListener("pointermove", (e) => {
      setLocalState((prevState) => ({
        ...prevState,
        x: e.clientX,
        y: e.clientY,
        user: currentUser,
      }));
    });
  }, []);

  return (
    <main>
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          padding: 0,
          margin: 0,
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        {Array.from(states.entries())
          .filter(([id]) => id !== localID)
          .map(([id, state]) => (
            <g key={id}>
              <circle cx={state.x} cy={state.y} r={5} />
              <text x={state.x + 7} y={state.y - 7} style={{ fontSize: 10 }}>
                {state.user.name}
              </text>
            </g>
          ))}
      </svg>
      <div>
        Connected:
        <ul>
          {Array.from(states.entries()).map(([id, state]) => (
            <li key={id}>{state?.user?.name}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
