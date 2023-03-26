import React, { useRef } from "react";
import { useParams } from "react-router-dom";
import { useAwareness, useWebRtc } from "@joebobmiles/y-react";
import { useFrame } from "@react-three/fiber";

function OnlinePlayer({ position }) {
  const meshRef = useRef();
  useFrame(() => {
    // Update the position of the mesh based on the prop value
    meshRef.current.position.set(position[0], position[1], position[2]);
    // ref.current.position.x = position[0];
    // ref.current.position.y = position[1];
    // ref.current.position.z = position[2];
    console.log("position: ", position);
  });
  return (
    <mesh castShadow ref={meshRef} position={[0, 1, 0]}>
      <boxGeometry attach="geometry" />
      <meshStandardMaterial attach="material" color="orange" transparent />
    </mesh>
  );
}

export function OnlinePlayers() {
  const { roomId } = useParams();

  const provider = useWebRtc(roomId);
  const { states, localID } = useAwareness(provider.awareness);

  return Array.from(states.entries())
    .filter(([id, state]) => id !== localID && state.pos)
    .map(([id, state]) => <OnlinePlayer key={id} position={state.pos} />);
}
