import React, { useEffect, useRef } from "react";
import { useSphere } from "@react-three/cannon";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { PointerLockControls } from "@react-three/drei";
import { useParams } from "react-router-dom";
import { useAwareness, useWebRtc } from "@joebobmiles/y-react";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { signalingServers } from "../../../constants";

const SPEED = 6;

export function Player(props) {
  const { roomId } = useParams();

  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
  });
  const { setLocalState } = useAwareness(provider.awareness);
  const { camera } = useThree();
  const { moveForward, moveBackward, moveLeft, moveRight, jump } =
    useKeyboardControls();
  const [ref, api] = useSphere(() => ({
    mass: 1,
    type: "Dynamic",
    ...props,
  }));

  const velocity = useRef([0, 0, 0]);
  useEffect(() => {
    api.velocity.subscribe((v) => (velocity.current = v));
  }, [api.velocity]);

  const pos = useRef([0, 0, 0]);
  useEffect(
    () => api.position.subscribe((v) => (pos.current = v)),
    [api.position]
  );

  useFrame(() => {
    camera.position.copy(
      new Vector3(pos.current[0], pos.current[1], pos.current[2])
    );
    const direction = new Vector3();

    const frontVector = new Vector3(
      0,
      0,
      (moveBackward ? 1 : 0) - (moveForward ? 1 : 0)
    );
    const sideVector = new Vector3(
      (moveLeft ? 1 : 0) - (moveRight ? 1 : 0),
      0,
      0
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
    setLocalState((prevState) => ({
      ...prevState,
      pos: pos.current,
    }));
  });
  return (
    <>
      <PointerLockControls />
      <mesh ref={ref} />
    </>
  );
}
