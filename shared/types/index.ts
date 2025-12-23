export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Train {
  id: string;
  name: string;
  position: {
    edgeId: string;
    sM: number;
    dir: 1 | -1;
  };
}
