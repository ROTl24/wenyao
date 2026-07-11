import * as THREE from 'three';

const OUTER_RADIUS = 0.7;
const HOLE_HALF_EXTENT = OUTER_RADIUS * 0.25;
const DEPTH = 0.16;
const BEVEL_THICKNESS = 0.025;
const RADIAL_SEGMENTS = 128;
const BEVEL_SEGMENTS = 4;
const FACE_NORMAL_THRESHOLD = 0.999;

type MaterialGroupIndex = 0 | 1 | 2 | 3;

export const QIANLONG_COIN_GROUP = {
  front: 0,
  reverse: 1,
  outerEdge: 2,
  holeWall: 3,
} as const;

function createCoinShape(): THREE.Shape {
  const shape = new THREE.Shape();

  for (let segment = 0; segment <= RADIAL_SEGMENTS; segment += 1) {
    const angle = -(segment / RADIAL_SEGMENTS) * Math.PI * 2;
    const x = Math.cos(angle) * OUTER_RADIUS;
    const y = Math.sin(angle) * OUTER_RADIUS;
    if (segment === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-HOLE_HALF_EXTENT, -HOLE_HALF_EXTENT);
  hole.lineTo(HOLE_HALF_EXTENT, -HOLE_HALF_EXTENT);
  hole.lineTo(HOLE_HALF_EXTENT, HOLE_HALF_EXTENT);
  hole.lineTo(-HOLE_HALF_EXTENT, HOLE_HALF_EXTENT);
  hole.closePath();
  shape.holes.push(hole);

  return shape;
}

function classifyTriangle(
  positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  normals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  start: number,
): MaterialGroupIndex {
  let centerX = 0;
  let centerY = 0;
  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;

  for (let offset = 0; offset < 3; offset += 1) {
    const vertex = start + offset;
    centerX += positions.getX(vertex);
    centerY += positions.getY(vertex);
    normalX += normals.getX(vertex);
    normalY += normals.getY(vertex);
    normalZ += normals.getZ(vertex);
  }

  normalZ /= 3;
  if (normalZ > FACE_NORMAL_THRESHOLD) return 0;
  if (normalZ < -FACE_NORMAL_THRESHOLD) return 1;

  // 外缘法线背离圆心；方孔内壁法线则朝向圆心。该判定也覆盖两侧倒角。
  return normalX * centerX + normalY * centerY >= 0 ? 2 : 3;
}

function faceUv(group: MaterialGroupIndex, x: number, y: number): [number, number] {
  const u = x / (OUTER_RADIUS * 2);
  const v = y / (OUTER_RADIUS * 2);
  return group === 1 ? [0.5 + u, 0.5 - v] : [0.5 + u, 0.5 + v];
}

function sideUv(x: number, y: number, z: number): [number, number] {
  const angle = Math.atan2(y, x);
  const totalThickness = DEPTH + BEVEL_THICKNESS * 2;
  return [
    (angle + Math.PI) / (Math.PI * 2),
    (z + totalThickness / 2) / totalThickness,
  ];
}

export function createQianlongCoinGeometry(): THREE.BufferGeometry {
  const extruded = new THREE.ExtrudeGeometry(createCoinShape(), {
    depth: DEPTH,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: BEVEL_SEGMENTS,
    bevelSize: 0.025,
    bevelThickness: BEVEL_THICKNESS,
    curveSegments: RADIAL_SEGMENTS,
  });
  extruded.translate(0, 0, -DEPTH / 2);
  extruded.computeVertexNormals();

  const sourcePositions = extruded.getAttribute('position');
  const sourceNormals = extruded.getAttribute('normal');
  const triangles: number[][] = [[], [], [], []];

  for (let start = 0; start < sourcePositions.count; start += 3) {
    triangles[classifyTriangle(sourcePositions, sourceNormals, start)].push(start);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const geometry = new THREE.BufferGeometry();

  triangles.forEach((starts, materialIndex) => {
    const groupStart = positions.length / 3;
    const vertexColor = new THREE.Color(materialIndex === QIANLONG_COIN_GROUP.holeWall
      ? '#4b3a24'
      : '#ffffff');

    for (const triangleStart of starts) {
      const triangle = [0, 1, 2].map((offset) => {
        const vertex = triangleStart + offset;
        return {
          vertex,
          x: sourcePositions.getX(vertex),
          y: sourcePositions.getY(vertex),
          z: sourcePositions.getZ(vertex),
        };
      });
      const triangleUvs = triangle.map(({ x, y, z }) => materialIndex < 2
        ? faceUv(materialIndex as MaterialGroupIndex, x, y)
        : sideUv(x, y, z));

      if (materialIndex >= 2) {
        const triangleU = triangleUvs.map(([u]) => u);
        if (Math.max(...triangleU) - Math.min(...triangleU) > 0.5) {
          triangleUvs.forEach((uv) => {
            if (uv[0] < 0.5) uv[0] += 1;
          });
        }
      }

      triangle.forEach(({ vertex, x, y, z }, offset) => {
        positions.push(x, y, z);
        normals.push(
          sourceNormals.getX(vertex),
          sourceNormals.getY(vertex),
          sourceNormals.getZ(vertex),
        );
        uvs.push(...triangleUvs[offset]);
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
      });
    }

    geometry.addGroup(groupStart, starts.length * 3, materialIndex);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = 'QianlongTongbaoCoinGeometry';

  extruded.dispose();
  return geometry;
}
