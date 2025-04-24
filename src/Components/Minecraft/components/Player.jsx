import React, { useEffect, useRef } from "react";
import { useSphere } from "@react-three/cannon";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { PointerLockControls } from "@react-three/drei";
import { useParams } from "react-router-dom";
import { useWebRtc } from "@joebobmiles/y-react";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { signalingServers } from "../../../constants";
import { useAuthStore } from "../../../hooks/useStore";

const SPEED = 6;

export function Player(props) {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers });
  const { camera } = useThree();
  const { moveForward, moveBackward, moveLeft, moveRight, jump } =
    useKeyboardControls();

  const [ref, api] = useSphere(() => ({
    mass: 1,
    type: "Dynamic",
    position: [0, 1, 0],
    ...props,
  }));

  const currentUser = useAuthStore((state) => state.currentUser);

  const playerColor =
    currentUser?.color ||
    ["red", "green", "purple", "orange"][Math.floor(Math.random() * 4)];
  const playerName = currentUser?.name || "Player";

  const velocity = useRef([0, 0, 0]);
  const position = useRef([0, 1, 0]);

  useEffect(() => {
    api.velocity.subscribe((v) => (velocity.current = v));
    api.position.subscribe((p) => (position.current = p));
  }, [api]);

  useEffect(() => {
    provider.awareness.setLocalState({
      pos: position.current,
      user: {
        name: playerName,
        color: playerColor,
      },
    });

    const updateAwareness = () => {
      provider.awareness.setLocalState({
        pos: position.current,
        user: { name: playerName, color: playerColor },
      });
    };

    const interval = setInterval(updateAwareness, 200);
    return () => clearInterval(interval);
  }, [provider.awareness, playerName, playerColor]);

  useFrame(() => {
    camera.position.copy(
      new Vector3(
        position.current[0],
        position.current[1],
        position.current[2],
      ),
    );

    const direction = new Vector3();

    const frontVector = new Vector3(
      0,
      0,
      (moveBackward ? 1 : 0) - (moveForward ? 1 : 0),
    );
    const sideVector = new Vector3(
      (moveLeft ? 1 : 0) - (moveRight ? 1 : 0),
      0,
      0,
    );

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(SPEED)
      .applyEuler(camera.rotation);

    api.velocity.set(direction.x, velocity.current[1], direction.z);

    if (jump && Math.abs(velocity.current[1].toFixed(2)) < 0.05) {
      api.velocity.set(velocity.current[0], 8, velocity.current[2]);
    }
  });

  return (
    <>
      <PointerLockControls />
      <mesh ref={ref} castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial opacity={0.2} transparent />
      </mesh>
    </>
  );
}
