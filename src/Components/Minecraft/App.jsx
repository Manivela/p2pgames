import { Physics } from "@react-three/cannon";
import { Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { useCallback, useMemo } from "react";

import { nanoid } from "nanoid";
import Cubes from "./components/Cubes";
import { Ground } from "./components/Ground";
import { Hud } from "./components/Hud";
import { OnlinePlayers } from "./components/OnlinePlayer";
import { Player } from "./components/Player";
import { useYjsState } from "./hooks/useYjsState";

function Minecraft() {
  const [cubes, setCubes] = useYjsState("minecraft-state", "cubes", []);

  const addCube = useCallback(
    (x, y, z, texture) => {
      const newCube = { key: nanoid(), pos: [x, y, z], texture };
      setCubes([...cubes, newCube]);
    },
    [cubes, setCubes],
  );

  const removeCube = useCallback(
    (x, y, z) => {
      setCubes(
        cubes.filter((cube) => {
          const [_x, _y, _z] = cube.pos;
          return _x !== x || _y !== y || _z !== z;
        }),
      );
    },
    [cubes, setCubes],
  );

  const canvasContent = useMemo(
    () => (
      <>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.5} />
        <pointLight
          castShadow
          intensity={0.8}
          position={[100, 100, 100]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight
          position={[50, 50, 20]}
          intensity={1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
          shadow-camera-near={0.1}
          shadow-camera-far={200}
          shadow-bias={-0.001}
        />
        <Hud position={[0, 0, -2]} />
        <Physics gravity={[0, -30, 0]}>
          <Ground position={[0, 0.5, 0]} addCube={addCube} />
          <Player position={[0, 3, 10]} />
          <OnlinePlayers />
          <Cubes cubes={cubes} addCube={addCube} removeCube={removeCube} />
        </Physics>
      </>
    ),
    [cubes, addCube, removeCube],
  );

  return (
    <Canvas shadows gl={{ alpha: false }}>
      {canvasContent}
    </Canvas>
  );
}

export default Minecraft;
