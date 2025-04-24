import React, { useMemo } from "react";
import { usePlane } from "@react-three/cannon";
import {
  TextureLoader,
  RepeatWrapping,
  NearestFilter,
  LinearMipMapLinearFilter,
} from "three";

import grass from "../images/grass.jpg";
import { useStore } from "../hooks/useStore";

export function Ground({ addCube, ...props }) {
  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], ...props }));

  const texture = useMemo(() => {
    const t = new TextureLoader().load(grass);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(100, 100);
    t.magFilter = NearestFilter;
    t.minFilter = LinearMipMapLinearFilter;
    return t;
  }, []);

  const activeTexture = useStore((state) => state.texture);

  return (
    <mesh
      ref={ref}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        const [x, y, z] = Object.values(e.point).map((coord) =>
          Math.ceil(coord),
        );
        addCube(x, y, z, activeTexture);
      }}
    >
      <planeGeometry attach="geometry" args={[100, 100]} />
      <meshStandardMaterial
        map={texture}
        attach="material"
        metalness={0.1}
        roughness={0.9}
      />
    </mesh>
  );
}
