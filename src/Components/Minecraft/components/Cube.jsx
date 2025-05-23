import React, { memo, useState } from "react";
import { useBox } from "@react-three/cannon";

import * as textures from "../textures";
import { useStore } from "../hooks/useStore";

function Cube({ position, texture, addCube: addCubeProp, removeCube }) {
  const activeTexture = useStore((state) => state.texture);
  const [hover, setHover] = useState(null);
  const addCube = (x, y, z) => addCubeProp(x, y, z, activeTexture);
  const [ref] = useBox(() => ({
    type: "Static",
    position,
  }));

  const color = texture === "glass" ? "skyblue" : "white";
  return (
    <mesh
      castShadow
      receiveShadow
      ref={ref}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(Math.floor(e.faceIndex / 2));
      }}
      onPointerOut={() => {
        setHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        const clickedFace = Math.floor(e.faceIndex / 2);
        const { x, y, z } = ref.current.position;
        if (clickedFace === 0) {
          e.altKey ? removeCube(x, y, z) : addCube(x + 1, y, z);
          return;
        }
        if (clickedFace === 1) {
          e.altKey ? removeCube(x, y, z) : addCube(x - 1, y, z);
          return;
        }
        if (clickedFace === 2) {
          e.altKey ? removeCube(x, y, z) : addCube(x, y + 1, z);
          return;
        }
        if (clickedFace === 3) {
          e.altKey ? removeCube(x, y, z) : addCube(x, y - 1, z);
          return;
        }
        if (clickedFace === 4) {
          e.altKey ? removeCube(x, y, z) : addCube(x, y, z + 1);
          return;
        }
        if (clickedFace === 5) {
          e.altKey ? removeCube(x, y, z) : addCube(x, y, z - 1);
        }
      }}
    >
      <boxGeometry attach="geometry" />
      <meshStandardMaterial
        attach="material"
        map={textures[texture]}
        color={hover != null ? "gray" : color}
        opacity={texture === "glass" ? 0.7 : 1}
        transparent
      />
    </mesh>
  );
}

function equalProps(prevProps, nextProps) {
  const equalPosition =
    prevProps.position.x === nextProps.position.x &&
    prevProps.position.y === nextProps.position.y &&
    prevProps.position.z === nextProps.position.z;

  return equalPosition && prevProps.texture === nextProps.texture;
}

export default memo(Cube, equalProps);
