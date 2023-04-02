import React, { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stats } from "@react-three/drei";
import { Physics } from "@react-three/cannon";

import { useMap } from "@joebobmiles/y-react";
import { nanoid } from "nanoid";
import { Ground } from "./components/Ground";
import Cubes from "./components/Cubes";
import { Player } from "./components/Player";
import { Hud } from "./components/Hud";
import { OnlinePlayers } from "./components/OnlinePlayer";

function Minecraft() {
  const ymap = useMap("minecraft-state");
  const cubes = ymap.get("cubes") || [];
  const addCube = (x, y, z, texture) => {
    const latestCubes = ymap.get("cubes") || cubes;
    ymap.set("cubes", [
      ...latestCubes,
      { key: nanoid(), pos: [x, y, z], texture },
    ]);
  };
  const removeCube = (x, y, z) => {
    const latestCubes = ymap.get("cubes") || cubes;
    ymap.set(
      "cubes",
      latestCubes.filter((cube) => {
        const [_x, _y, _z] = cube.pos;
        return _x !== x || _y !== y || _z !== z;
      })
    );
  };
  return (
    <Canvas>
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={0.25} />
      <pointLight castShadow intensity={0.7} position={[100, 100, 100]} />
      <Hud position={[0, 0, -2]} />
      <Physics gravity={[0, -30, 0]}>
        <Ground position={[0, 0.5, 0]} addCube={addCube} />
        <Player position={[0, 3, 10]} />
        <OnlinePlayers />
        <Cubes cubes={cubes} addCube={addCube} removeCube={removeCube} />
      </Physics>
    </Canvas>
  );
}

export default Minecraft;
