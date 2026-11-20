import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  CAMPUS_ANCHOR_COORDS,
  CAMPUS_BUILDING_DIRECTORY,
  CAMPUS_CENTER,
  INITIAL_CAMPUS_NOTICES,
} from './data/campusData';
import {
  AmenityCategory,
  CampusBuilding,
  GeolocationStatus,
  LatLngLiteral,
  OriginAnchorMode,
  WalkingRouteResult,
} from './types/campus';
import {
  computeCampusWalkingRoute,
  computeHaversineMeters,
} from './services/routingService';
import {Header} from './components/Header';
import {ExplorerSidebar} from './components/ExplorerSidebar';
import {Campus3DModel} from './components/Campus3DModel';

const READ_NOTICES_STORAGE_KEY = 'cku_read_notices_v1';

function loadInitialReadNotices(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(READ_NOTICES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export default function App() {
  const [cameraRecenterNonce, setCameraRecenterNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAmenityFilter, setActiveAmenityFilter] =
    useState<AmenityCategory>('all');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null
  );

  const [userGpsLocation, setUserGpsLocation] = useState<LatLngLiteral | null>(
    null
  );
  const [geoStatus, setGeoStatus] = useState<GeolocationStatus>('idle');
  const [originMode, setOriginMode] = useState<OriginAnchorMode>('main-gate');

  const [activeRoute, setActiveRoute] = useState<WalkingRouteResult | null>(
    null
  );
  const [activeNavTarget, setActiveNavTarget] = useState<{
    label: string;
    destination: LatLngLiteral;
  } | null>(null);

  const [readNoticeIds, setReadNoticeIds] = useState<Record<string, boolean>>(
    () => loadInitialReadNotices()
  );

  const watchIdRef = useRef<number | null>(null);

  // Persist read notices in localStorage (no login required)
  useEffect(() => {
    try {
      localStorage.setItem(
        READ_NOTICES_STORAGE_KEY,
        JSON.stringify(readNoticeIds)
      );
    } catch {
      // Ignore storage errors
    }
  }, [readNoticeIds]);

  // Watch browser real-time geolocation on mount
  const startGeolocationWatch = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unavailable');
      return;
    }

    setGeoStatus('locating');

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: LatLngLiteral = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserGpsLocation(coords);
        setGeoStatus('active');

        const dist = computeHaversineMeters(coords, CAMPUS_CENTER);
        if (dist <= 4000) {
          setOriginMode('gps');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
        } else {
          setGeoStatus('unavailable');
        }
        setOriginMode((prev) => (prev === 'gps' ? 'main-gate' : prev));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  }, []);

  useEffect(() => {
    startGeolocationWatch();
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startGeolocationWatch]);

  const buildings = CAMPUS_BUILDING_DIRECTORY;

  // Determine active origin coordinates based on selected mode
  const activeOriginInfo = useMemo(() => {
    if (originMode === 'gps' && userGpsLocation) {
      return {
        coords: userGpsLocation,
        label: '현재 내 위치',
      };
    }
    if (originMode === 'back-gate') {
      return {
        coords: CAMPUS_ANCHOR_COORDS.backGate.location,
        label: '가톨릭관동대 후문',
      };
    }
    if (originMode === 'maria-hall') {
      const maria = buildings.find((b) => b.id === 'maria-hall');
      return {
        coords: maria?.location ?? CAMPUS_CENTER,
        label: '마리아관(캠퍼스 중심)',
      };
    }
    return {
      coords: CAMPUS_ANCHOR_COORDS.mainGate.location,
      label: '가톨릭관동대 정문',
    };
  }, [originMode, userGpsLocation, buildings]);

  // Recompute active campus walking route automatically when target or origin changes
  useEffect(() => {
    if (!activeNavTarget) {
      setActiveRoute(null);
      return;
    }
    const route = computeCampusWalkingRoute(
      activeOriginInfo.coords,
      activeNavTarget.destination,
      activeOriginInfo.label,
      activeNavTarget.label
    );
    setActiveRoute(route);
  }, [activeNavTarget, activeOriginInfo]);

  const handleSelectBuilding = useCallback((buildingId: string | null) => {
    setSelectedBuildingId(buildingId);
  }, []);

  const handleStartNavigation = useCallback((building: CampusBuilding) => {
    setSelectedBuildingId(building.id);
    setActiveNavTarget({
      label: building.name,
      destination: building.location,
    });
  }, []);

  const handleClearRoute = useCallback(() => {
    setActiveNavTarget(null);
    setActiveRoute(null);
  }, []);

  const handleLocateMe = useCallback(() => {
    if (userGpsLocation) {
      setOriginMode('gps');
      setSelectedBuildingId(null);
      setCameraRecenterNonce((n) => n + 1);
    } else {
      startGeolocationWatch();
      setCameraRecenterNonce((n) => n + 1);
    }
  }, [userGpsLocation, startGeolocationWatch]);

  const handleMarkNoticeRead = useCallback((id: string) => {
    setReadNoticeIds((prev) => (prev[id] ? prev : {...prev, [id]: true}));
  }, []);

  const handleMarkAllNoticesRead = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of INITIAL_CAMPUS_NOTICES) {
      next[n.id] = true;
    }
    setReadNoticeIds(next);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFB] text-slate-900 overflow-hidden">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        buildings={buildings}
        onSelectBuilding={handleSelectBuilding}
        notices={INITIAL_CAMPUS_NOTICES}
        readNoticeIds={readNoticeIds}
        onMarkNoticeRead={handleMarkNoticeRead}
        onMarkAllNoticesRead={handleMarkAllNoticesRead}
        geoStatus={geoStatus}
        onLocateMe={handleLocateMe}
      />

      <main className="flex-1 flex flex-col-reverse lg:flex-row min-h-0 overflow-hidden">
        <ExplorerSidebar
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={handleSelectBuilding}
          activeAmenityFilter={activeAmenityFilter}
          onAmenityFilterChange={setActiveAmenityFilter}
          searchQuery={searchQuery}
          activeOrigin={activeOriginInfo.coords}
          originMode={originMode}
          onOriginModeChange={setOriginMode}
          geoStatus={geoStatus}
          activeRoute={activeRoute}
          onStartNavigation={handleStartNavigation}
          onClearRoute={handleClearRoute}
          notices={INITIAL_CAMPUS_NOTICES}
        />

        <div className="relative flex-1 flex min-h-[300px] min-w-0">
          <Campus3DModel
            campusCenter={CAMPUS_CENTER}
            buildings={buildings}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={handleSelectBuilding}
            activeAmenityFilter={activeAmenityFilter}
            userGpsLocation={userGpsLocation}
            activeOrigin={activeOriginInfo.coords}
            originMode={originMode}
            geoStatus={geoStatus}
            activeRoute={activeRoute}
            cameraRecenterNonce={cameraRecenterNonce}
          />
        </div>
      </main>
    </div>
  );
}
