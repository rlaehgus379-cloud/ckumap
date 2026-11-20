import {
  CAMPUS_ANCHOR_COORDS,
  CAMPUS_BUILDING_DIRECTORY,
} from '../data/campusData';
import {
  LatLngLiteral,
  RouteStepInfo,
  WalkingRouteResult,
} from '../types/campus';

export function computeHaversineMeters(
  a: LatLngLiteral,
  b: LatLngLiteral
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function estimateWalkingMinutes(distanceMeters: number): number {
  // Average campus walking pace ~75m/min
  return Math.max(1, Math.ceil(distanceMeters / 75));
}

export function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

interface CampusGraphNode {
  id: string;
  label: string;
  location: LatLngLiteral;
}

export const CENTRAL_PLAZA_LOCATION: LatLngLiteral = {
  lat: 37.7368,
  lng: 128.8749,
};

const CAMPUS_JUNCTION_NODES: CampusGraphNode[] = [
  {
    id: 'main-gate',
    label: '정문',
    location: CAMPUS_ANCHOR_COORDS.mainGate.location,
  },
  {
    id: 'back-gate',
    label: '후문',
    location: CAMPUS_ANCHOR_COORDS.backGate.location,
  },
  {
    id: 'central-plaza',
    label: '중앙광장',
    location: CENTRAL_PLAZA_LOCATION,
  },
];

// Internal campus road & walkway edges connecting buildings, central plaza, and gates
const CAMPUS_WALKWAY_EDGES: Array<[string, string]> = [
  ['main-gate', 'joseph-hall'],
  ['main-gate', 'francis-chapel'],
  ['joseph-hall', 'francis-chapel'],
  ['joseph-hall', 'jinsil-hall'],
  ['joseph-hall', 'maria-hall'],
  ['francis-chapel', 'jinsil-hall'],
  ['jinsil-hall', 'maria-hall'],
  ['jinsil-hall', 'michael-hall'],
  ['maria-hall', 'central-plaza'],
  ['maria-hall', 'changjo-hall'],
  ['central-plaza', 'changjo-hall'],
  ['central-plaza', 'central-library'],
  ['central-plaza', 'student-union'],
  ['changjo-hall', 'student-union'],
  ['central-library', 'michael-hall'],
  ['central-library', 'raphael-hall'],
  ['central-library', 'student-union'],
  ['student-union', 'sebastiano-sports'],
  ['student-union', 'raphael-hall'],
  ['raphael-hall', 'back-gate'],
  ['sebastiano-sports', 'back-gate'],
  ['raphael-hall', 'sebastiano-sports'],
];

function getAllCampusNodes(): CampusGraphNode[] {
  const buildingNodes: CampusGraphNode[] = CAMPUS_BUILDING_DIRECTORY.map(
    (b) => ({
      id: b.id,
      label: b.name,
      location: b.location,
    })
  );
  return [...buildingNodes, ...CAMPUS_JUNCTION_NODES];
}

export function getCampusWalkwaySegments(): Array<{
  a: LatLngLiteral;
  b: LatLngLiteral;
  isMainSpine: boolean;
}> {
  const nodes = getAllCampusNodes();
  const byId: Record<string, CampusGraphNode> = {};
  for (const n of nodes) byId[n.id] = n;

  const mainSpineIds = new Set([
    'main-gate',
    'joseph-hall',
    'maria-hall',
    'central-plaza',
    'central-library',
    'back-gate',
  ]);

  const segments: Array<{
    a: LatLngLiteral;
    b: LatLngLiteral;
    isMainSpine: boolean;
  }> = [];

  for (const [fromId, toId] of CAMPUS_WALKWAY_EDGES) {
    const na = byId[fromId];
    const nb = byId[toId];
    if (!na || !nb) continue;
    segments.push({
      a: na.location,
      b: nb.location,
      isMainSpine: mainSpineIds.has(fromId) && mainSpineIds.has(toId),
    });
  }
  return segments;
}

function findNearestNode(
  coords: LatLngLiteral,
  nodes: CampusGraphNode[]
): {node: CampusGraphNode; distance: number} {
  let bestNode = nodes[0];
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = computeHaversineMeters(coords, n.location);
    if (d < bestDist) {
      bestDist = d;
      bestNode = n;
    }
  }
  return {node: bestNode, distance: bestDist};
}

function runDijkstra(
  startId: string,
  endId: string,
  nodesById: Record<string, CampusGraphNode>
): string[] {
  const adj: Record<string, Array<{to: string; weight: number}>> = {};
  for (const id of Object.keys(nodesById)) {
    adj[id] = [];
  }
  for (const [a, b] of CAMPUS_WALKWAY_EDGES) {
    const na = nodesById[a];
    const nb = nodesById[b];
    if (!na || !nb) continue;
    const w = computeHaversineMeters(na.location, nb.location);
    adj[a].push({to: b, weight: w});
    adj[b].push({to: a, weight: w});
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>(Object.keys(nodesById));

  for (const id of unvisited) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  dist[startId] = 0;

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minD = Infinity;
    for (const id of unvisited) {
      if (dist[id] < minD) {
        minD = dist[id];
        curr = id;
      }
    }
    if (!curr || curr === endId || minD === Infinity) break;
    unvisited.delete(curr);

    for (const edge of adj[curr] ?? []) {
      if (!unvisited.has(edge.to)) continue;
      const alt = dist[curr] + edge.weight;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = curr;
      }
    }
  }

  const path: string[] = [];
  let step: string | null = endId;
  while (step) {
    path.unshift(step);
    step = prev[step] ?? null;
  }
  if (path[0] !== startId) {
    return [startId, endId];
  }
  return path;
}

export function computeCampusWalkingRoute(
  origin: LatLngLiteral,
  destination: LatLngLiteral,
  originLabel: string,
  destinationLabel: string
): WalkingRouteResult {
  const nodes = getAllCampusNodes();
  const nodesById: Record<string, CampusGraphNode> = {};
  for (const n of nodes) {
    nodesById[n.id] = n;
  }

  const startMatch = findNearestNode(origin, nodes);
  const endMatch = findNearestNode(destination, nodes);
  const isOutsideCampus = startMatch.distance > 1200;

  // If user GPS is far off-campus, route from Main Gate into campus while reporting total distance
  const effectiveStartId = isOutsideCampus ? 'main-gate' : startMatch.node.id;
  const nodePath = runDijkstra(effectiveStartId, endMatch.node.id, nodesById);

  const pathCoords: LatLngLiteral[] = [];
  if (!isOutsideCampus && startMatch.distance > 12) {
    pathCoords.push(origin);
  }
  for (const id of nodePath) {
    const n = nodesById[id];
    if (n) pathCoords.push(n.location);
  }
  if (endMatch.distance > 12) {
    pathCoords.push(destination);
  }

  // Build turn-by-turn campus walkway steps
  const steps: RouteStepInfo[] = [];
  let totalMeters = 0;

  if (isOutsideCampus) {
    const approachMeters = computeHaversineMeters(
      origin,
      CAMPUS_ANCHOR_COORDS.mainGate.location
    );
    totalMeters += approachMeters;
    steps.push({
      instruction: `현재 위치에서 가톨릭관동대 정문까지 이동하세요.`,
      distanceMeters: approachMeters,
      durationSeconds: estimateWalkingMinutes(approachMeters) * 60,
    });
  } else if (startMatch.distance > 12) {
    totalMeters += startMatch.distance;
    steps.push({
      instruction: `${originLabel}에서 ${startMatch.node.label} 방면 교내 보행로로 진입하세요.`,
      distanceMeters: startMatch.distance,
      durationSeconds: Math.max(15, Math.round(startMatch.distance / 1.25)),
    });
  }

  for (let i = 0; i < nodePath.length - 1; i++) {
    const fromNode = nodesById[nodePath[i]];
    const toNode = nodesById[nodePath[i + 1]];
    if (!fromNode || !toNode) continue;
    const segMeters = computeHaversineMeters(
      fromNode.location,
      toNode.location
    );
    totalMeters += segMeters;
    const isLast = i === nodePath.length - 2 && endMatch.distance <= 12;
    steps.push({
      instruction: isLast
        ? `${fromNode.label}에서 교내 도로를 따라 ${destinationLabel}에 도착합니다.`
        : `${fromNode.label}에서 ${toNode.label} 방면 교내 보행로로 이동하세요.`,
      distanceMeters: segMeters,
      durationSeconds: Math.max(20, Math.round(segMeters / 1.25)),
    });
  }

  if (endMatch.distance > 12) {
    totalMeters += endMatch.distance;
    steps.push({
      instruction: `${endMatch.node.label}에서 ${destinationLabel} 입구로 이동하세요.`,
      distanceMeters: endMatch.distance,
      durationSeconds: Math.max(15, Math.round(endMatch.distance / 1.25)),
    });
  }

  if (steps.length === 0) {
    steps.push({
      instruction: `현재 출발지 바로 인근에 ${destinationLabel}이(가) 위치해 있습니다.`,
      distanceMeters: 15,
      durationSeconds: 15,
    });
    totalMeters = 15;
  }

  const durationMinutes = estimateWalkingMinutes(totalMeters);

  return {
    origin,
    destination,
    originLabel,
    destinationLabel,
    distanceMeters: totalMeters,
    durationMinutes,
    steps,
    mode: isOutsideCampus ? 'gps-to-campus' : 'campus-network',
    pathCoords: pathCoords.length >= 2 ? pathCoords : [origin, destination],
  };
}
