import React from "react";

import Cube from "./Cube";
import { useStore } from "../hooks/useStore";

export default function Cubes({ cubes, addCube, removeCube }) {
  return cubes.map((cube) => (
    <Cube
      key={cube.key}
      texture={cube.texture}
      position={cube.pos}
      addCube={addCube}
      removeCube={removeCube}
    />
  ));
}
