export type AmenityCategory = 'all' | 'cafe' | 'dining' | 'convenience' | 'study';

export type NoticeCategory = 'all' | '학사' | '시설' | '행사' | '긴급';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface CampusAmenity {
  id: string;
  name: string;
  category: Exclude<AmenityCategory, 'all'> | 'service';
  categoryLabel: string;
  floor: string;
  hours: string;
  description: string;
}

export interface CampusBuilding {
  id: string;
  name: string;
  shortCode: string;
  zone: string;
  address: string;
  location: LatLngLiteral;
  summary: string;
  departments: string[];
  amenities: CampusAmenity[];
}

export interface CampusNotice {
  id: string;
  category: Exclude<NoticeCategory, 'all'>;
  title: string;
  summary: string;
  date: string;
  buildingId?: string;
  buildingName?: string;
  isImportant?: boolean;
}

export interface RouteStepInfo {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface WalkingRouteResult {
  origin: LatLngLiteral;
  destination: LatLngLiteral;
  originLabel: string;
  destinationLabel: string;
  distanceMeters: number;
  durationMinutes: number;
  steps: RouteStepInfo[];
  mode: 'campus-network' | 'gps-to-campus';
  pathCoords: LatLngLiteral[];
}

export type GeolocationStatus =
  | 'idle'
  | 'locating'
  | 'active'
  | 'denied'
  | 'unavailable';

export type OriginAnchorMode =
  | 'gps'
  | 'main-gate'
  | 'back-gate'
  | 'maria-hall';
