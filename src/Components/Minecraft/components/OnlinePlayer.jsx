import React, { useRef } from "react";
import { useParams } from "react-router-dom";
import { useAwareness, useWebRtc } from "@joebobmiles/y-react";
import { useFrame, extend, useThree } from "@react-three/fiber";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { Text } from "@react-three/drei";
import { signalingServers } from "../../../constants";

extend({ TextGeometry });

function OnlinePlayer({ position, color, name }) {
  const { camera } = useThree();

  const meshRef = useRef();
  const textRef = useRef();

  useFrame(() => {
    // Update the position of the mesh based on the prop value
    meshRef.current.position.set(position[0], position[1], position[2]);
    textRef.current.lookAt(camera.position);
    // textRef.current.rotation.applyMatrix(matrix);
  });
  return (
    <group ref={meshRef} position={[0, 1, 0]}>
      <mesh castShadow>
        <sphereGeometry attach="geometry" />
        <meshStandardMaterial attach="material" color={color} transparent />
      </mesh>
      <Text
        ref={textRef}
        color="white"
        position={[0, 2, 0]}
        // rotation={[0, 1, 0]}
      >
        {name}
      </Text>
    </group>
  );
}

export function OnlinePlayers() {
  const { roomId } = useParams();

  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
  });
  const { states, localID } = useAwareness(provider.awareness);

  return Array.from(states.entries())
    .filter(([id, state]) => id !== localID && state.pos)
    .map(([id, state]) => (
      <OnlinePlayer
        key={id}
        position={state.pos}
        color={state.user.color}
        name={state.user.name}
      />
    ));
}
