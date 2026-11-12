import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useWebRtc, useAwareness } from "../vendor/y-react";
import { useAuthStore } from "../hooks/useStore";
import { signalingServers, peerOpts } from "../constants";

const colors = ["orange", "blue", "yellow", "green"];

const disabledPaths = ["okey", "backgammon"];

export default function Awareness() {
  const { roomId } = useParams();
  const location = useLocation();
  const disabled = disabledPaths.some((d) => location.pathname.includes(d));
  const [connectedUsers, setConnectedUsers] = useState([]);

  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
    peerOpts,
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
      // the same player, or a new name for them (the menu)
      if (prevState?.user?.id === userData.id) {
        return prevState.user.name === userData.name
          ? prevState
          : { ...prevState, user: userData };
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

  // you to the others (above), and their pointers: who's here is the
  // menu's (Menu.jsx)
  if (disabled) return null;
  return (
    <svg
      style={{
        position: "fixed",
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
  );
}
