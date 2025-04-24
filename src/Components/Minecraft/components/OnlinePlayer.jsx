import React, { useRef, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAwareness, useWebRtc } from "@joebobmiles/y-react";
import { extend, useThree, useFrame } from "@react-three/fiber";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { Text } from "@react-three/drei";
import { Vector3 } from "three";
import { signalingServers } from "../../../constants";

extend({ TextGeometry });

const OnlinePlayer = ({ position, color, name }) => {
  const { camera } = useThree();
  const textRef = useRef();
  const playerRef = useRef();
  const targetPosition = useRef(new Vector3(...position));
  const currentPosition = useRef(new Vector3(...position));

  useEffect(() => {
    targetPosition.current.set(...position);
  }, [position]);

  useFrame((state, delta) => {
    if (textRef.current) {
      textRef.current.lookAt(camera.position);
    }

    const lerpFactor = Math.min(1, delta * 10);

    currentPosition.current.lerp(targetPosition.current, lerpFactor);

    if (playerRef.current) {
      playerRef.current.position.copy(currentPosition.current);
    }
  });

  return (
    <group ref={playerRef}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        ref={textRef}
        position={[0, 1, 0]}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontSize={0.5}
      >
        {name}
      </Text>
    </group>
  );
};

export function OnlinePlayers() {
  const { roomId } = useParams();
  const [stablePlayerStates, setStablePlayerStates] = useState({});

  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
  });

  const { states, localID } = useAwareness(provider.awareness);

  useEffect(() => {
    const handleAwarenessUpdate = () => {
      const currentTime = Date.now();

      setStablePlayerStates((prev) => {
        const newPlayerStates = { ...prev };

        Array.from(states.entries()).forEach(([id, state]) => {
          if (id === localID || !state?.pos || !Array.isArray(state.pos))
            return;

          newPlayerStates[id] = {
            id,
            position: [...state.pos],
            color: state.user?.color || "blue",
            name: state.user?.name || "Player",
            lastSeen: currentTime,
          };
        });

        return newPlayerStates;
      });
    };

    provider.awareness.on("change", handleAwarenessUpdate);
    handleAwarenessUpdate();

    return () => {
      provider.awareness.off("change", handleAwarenessUpdate);
    };
  }, [provider.awareness, localID, states]);

  const visiblePlayers = useMemo(() => {
    return Object.values(stablePlayerStates);
  }, [stablePlayerStates]);

  return visiblePlayers.map((player) => (
    <OnlinePlayer
      key={player.id}
      position={player.position}
      color={player.color}
      name={player.name}
    />
  ));
}
