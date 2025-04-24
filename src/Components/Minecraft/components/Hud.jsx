import React, { useState, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useStore } from "../hooks/useStore";
import * as textures from "../textures";

function Material({ args, color, texture, isActive, ...props }) {
  return (
    <mesh {...props}>
      <boxGeometry attach="geometry" args={args} />
      {[...Array(6)].map((_, index) => (
        <meshStandardMaterial
          attachArray="material"
          map={texture}
          key={index}
          transparent
          opacity={isActive ? 1 : 0.3}
        />
      ))}
    </mesh>
  );
}

function MaterialContainer({ args, color, activeTexture, ...props }) {
  const activeTextureIndex = Object.keys(textures).indexOf(activeTexture);
  return (
    <mesh {...props}>
      {Object.keys(textures).map((key, index) => (
        <Material
          key={key}
          isActive={activeTextureIndex === index}
          texture={textures[key]}
          args={[0.2, 0.2, 0.05]}
          position={[-0.5 + index / 4, 0, 0.01]}
        />
      ))}
      <boxGeometry attach="geometry" args={args} />

      <meshStandardMaterial attach="material" color={color} transparent />
    </mesh>
  );
}

export function Hud({ position }) {
  const { camera } = useThree();
  const posRef = useRef(camera.position.clone());
  const rotRef = useRef([0, 0, 0]);
  const [hudVisible, setHudVisible] = useState(false);

  const activeTexture = useStore((state) => state.texture);
  const prevTextureRef = useRef(activeTexture);

  useFrame(() => {
    posRef.current.copy(camera.position);
    rotRef.current = [camera.rotation.x, camera.rotation.y, camera.rotation.z];
  });

  useEffect(() => {
    if (prevTextureRef.current !== activeTexture) {
      prevTextureRef.current = activeTexture;
      setHudVisible(true);

      const hudVisibilityTimeout = setTimeout(() => {
        setHudVisible(false);
      }, 2000);

      return () => clearTimeout(hudVisibilityTimeout);
    }
  }, [activeTexture]);

  if (!hudVisible) return null;

  return (
    <group
      position={[posRef.current.x, posRef.current.y, posRef.current.z]}
      rotation={rotRef.current}
    >
      <group position={position}>
        <MaterialContainer
          args={[1.3, 0.3, 0.01]}
          color="#222"
          activeTexture={activeTexture}
        />
      </group>
    </group>
  );
}
