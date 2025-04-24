import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useWebRtc, useAwareness } from "@joebobmiles/y-react";
import { useAuthStore } from "../hooks/useStore";
import { signalingServers } from "../constants";

const colors = ["orange", "blue", "yellow", "green"];

const disabledPaths = ["okey", "minecraft"];

export default function Awareness() {
  const { roomId } = useParams();
  const location = useLocation();
  const disabled = disabledPaths.some((d) => location.pathname.includes(d));
  const [connectedUsers, setConnectedUsers] = useState([]);

  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
  });
  const { states, localID, setLocalState } = useAwareness(provider.awareness);
  const currentUser = useAuthStore((state) => state.currentUser);

  const userData = useMemo(
    () =>
      currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            color: currentUser.color,
          }
        : null,
    [currentUser?.id, currentUser?.name, currentUser?.color],
  );

  const handlePointerMove = useCallback(
    (e) => {
      setLocalState((prevState) => ({
        ...prevState,
        x: e.clientX,
        y: e.clientY,
        user: userData,
      }));
    },
    [setLocalState, userData],
  );

  useEffect(() => {
    if (!userData) return;

    setLocalState((prevState) => {
      if (prevState?.user?.id === userData.id) {
        return prevState;
      }
      return {
        color: colors[Math.floor(Math.random() * colors.length)],
        ...prevState,
        user: userData,
      };
    });

    if (!disabled) {
      window.addEventListener("pointermove", handlePointerMove);
    }
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [disabled, handlePointerMove, userData, setLocalState]);

  useEffect(() => {
    const updateConnectedUsers = () => {
      setConnectedUsers(Array.from(states.entries()));
    };

    updateConnectedUsers();

    provider.awareness.on("change", updateConnectedUsers);

    return () => {
      provider.awareness.off("change", updateConnectedUsers);
    };
  }, [provider.awareness, states]);

  return (
    <main>
      {!disabled && (
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
          {connectedUsers
            .filter(([id, state]) => id !== localID && state.x)
            .map(([id, state]) => (
              <g key={id}>
                <circle cx={state.x} cy={state.y} r={5} />
                <text x={state.x + 7} y={state.y - 7} style={{ fontSize: 10 }}>
                  {state.user?.name}
                </text>
              </g>
            ))}
        </svg>
      )}
      <div>
        Connected:
        <ul>
          {connectedUsers.map(([id, state]) => (
            <li key={id}>{state?.user?.name}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
