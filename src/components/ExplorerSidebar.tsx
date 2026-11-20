import React, {useMemo, useState} from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Coffee,
  Footprints,
  MapPin,
  Navigation,
  ShoppingBag,
  Utensils,
} from 'lucide-react';
import {
  AmenityCategory,
  CampusBuilding,
  CampusNotice,
  GeolocationStatus,
  LatLngLiteral,
  OriginAnchorMode,
  WalkingRouteResult,
} from '../types/campus';
import {
  computeHaversineMeters,
  estimateWalkingMinutes,
  formatDistanceLabel,
} from '../services/routingService';

interface ExplorerSidebarProps {
  buildings: CampusBuilding[];
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string | null) => void;
  activeAmenityFilter: AmenityCategory;
  onAmenityFilterChange: (cat: AmenityCategory) => void;
  searchQuery: string;
  activeOrigin: LatLngLiteral | null;
  originMode: OriginAnchorMode;
  onOriginModeChange: (mode: OriginAnchorMode) => void;
  geoStatus: GeolocationStatus;
  activeRoute: WalkingRouteResult | null;
  onStartNavigation: (building: CampusBuilding) => void;
  onClearRoute: () => void;
  notices: CampusNotice[];
}

const AMENITY_FILTERS: {
  id: AmenityCategory;
  label: string;
  icon: React.FC<{className?: string}>;
}[] = [
  {id: 'all', label: '전체', icon: MapPin},
  {id: 'cafe', label: '카페', icon: Coffee},
  {id: 'dining', label: '식당', icon: Utensils},
  {id: 'convenience', label: '편의점', icon: ShoppingBag},
  {id: 'study', label: '열람실', icon: BookOpen},
];

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  activeAmenityFilter,
  onAmenityFilterChange,
  searchQuery,
  activeOrigin,
  originMode,
  onOriginModeChange,
  geoStatus,
  activeRoute,
  onStartNavigation,
  onClearRoute,
  notices,
}) => {
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId]
  );

  const filteredBuildings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return buildings.filter((b) => {
      const matchesCategory =
        activeAmenityFilter === 'all' ||
        b.amenities.some((a) => a.category === activeAmenityFilter);

      if (!matchesCategory) return false;
      if (!q) return true;

      return (
        b.name.toLowerCase().includes(q) ||
        b.zone.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q) ||
        b.departments.some((d) => d.toLowerCase().includes(q)) ||
        b.amenities.some(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.categoryLabel.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        )
      );
    });
  }, [buildings, activeAmenityFilter, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<AmenityCategory, number> = {
      all: buildings.length,
      cafe: 0,
      dining: 0,
      convenience: 0,
      study: 0,
    };
    for (const b of buildings) {
      if (b.amenities.some((a) => a.category === 'cafe')) counts.cafe += 1;
      if (b.amenities.some((a) => a.category === 'dining')) counts.dining += 1;
      if (b.amenities.some((a) => a.category === 'convenience'))
        counts.convenience += 1;
      if (b.amenities.some((a) => a.category === 'study')) counts.study += 1;
    }
    return counts;
  }, [buildings]);

  const relatedNotices = useMemo(() => {
    if (!selectedBuilding) return [];
    return notices.filter((n) => n.buildingId === selectedBuilding.id);
  }, [notices, selectedBuilding]);

  return (
    <aside
      aria-label="캠퍼스 시설 및 길 안내 패널"
      className={`bg-white border-t lg:border-t-0 lg:border-r border-slate-200 w-full lg:w-[410px] shrink-0 flex flex-col z-20 transition-all duration-200 ${
        mobileCollapsed ? 'h-14 lg:h-full' : 'h-[48vh] lg:h-full'
      }`}
    >
      {/* Mobile collapse/expand handle */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <button
          type="button"
          onClick={() => setMobileCollapsed((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          <span>
            {selectedBuilding
              ? `${selectedBuilding.name} 상세 정보`
              : activeRoute
              ? `${activeRoute.destinationLabel} 길 안내 중`
              : `캠퍼스 시설 (${filteredBuildings.length})`}
          </span>
          {mobileCollapsed ? (
            <ChevronUp className="w-4 h-4 text-[#006272]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#006272]" />
          )}
        </button>
        {activeRoute && (
          <span className="text-xs font-semibold text-[#006272] tabular-nums">
            {formatDistanceLabel(activeRoute.distanceMeters)} · 약{' '}
            {activeRoute.durationMinutes}분
          </span>
        )}
      </div>

      {/* Quick Amenity Category Filter Bar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <div
          role="tablist"
          aria-label="주요 편의시설 빠른 필터"
          className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {AMENITY_FILTERS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAmenityFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => {
                  onAmenityFilterChange(tab.id);
                  if (mobileCollapsed) setMobileCollapsed(false);
                }}
                className={`flex items-center justify-center gap-1 px-1.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#006272] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] tabular-nums ${
                    isActive ? 'text-white/80' : 'text-slate-400'
                  }`}
                >
                  {categoryCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Workspace Content */}
      <div className="flex-1 overflow-y-auto cku-scroll divide-y divide-slate-200">
        {/* Active Walking Route Panel */}
        {activeRoute && (
          <section className="p-4 bg-[#EAF4F6]/60">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#006272]">
                  <Footprints className="w-3.5 h-3.5 shrink-0" />
                  <span>교내 도보 길 안내</span>
                </div>
                <h3 className="mt-1 text-sm font-bold text-slate-900 truncate">
                  {activeRoute.originLabel} → {activeRoute.destinationLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClearRoute}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                안내 종료
              </button>
            </div>

            {/* Origin Selector */}
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-slate-500 mr-1">
                출발지
              </span>
              <button
                type="button"
                onClick={() => onOriginModeChange('gps')}
                disabled={geoStatus === 'denied' || geoStatus === 'unavailable'}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  originMode === 'gps'
                    ? 'bg-[#006272] text-white border-[#006272]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                현재 내 위치
              </button>
              <button
                type="button"
                onClick={() => onOriginModeChange('main-gate')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  originMode === 'main-gate'
                    ? 'bg-[#006272] text-white border-[#006272]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                정문 출발
              </button>
              <button
                type="button"
                onClick={() => onOriginModeChange('back-gate')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  originMode === 'back-gate'
                    ? 'bg-[#006272] text-white border-[#006272]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                후문 출발
              </button>
              <button
                type="button"
                onClick={() => onOriginModeChange('maria-hall')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  originMode === 'maria-hall'
                    ? 'bg-[#006272] text-white border-[#006272]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                마리아관
              </button>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline justify-between gap-3 py-2 border-y border-[#B8DCE2]">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[#006272] tabular-nums">
                    약 {activeRoute.durationMinutes}분
                  </span>
                  <span className="text-xs text-slate-600 font-mono-num">
                    {formatDistanceLabel(activeRoute.distanceMeters)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStepsExpanded((prev) => !prev)}
                  className="text-xs font-medium text-[#006272] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {stepsExpanded ? '세부 경로 접기' : '세부 경로 보기'}
                </button>
              </div>

              {activeRoute.mode === 'gps-to-campus' && (
                <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                  현재 위치가 캠퍼스 외부에 있어 정문 진입 이후의 교내 보행
                  동선으로 안내합니다.
                </p>
              )}

              {stepsExpanded && activeRoute.steps.length > 0 && (
                <ol className="mt-2.5 space-y-2 max-h-44 overflow-y-auto cku-scroll pr-1">
                  {activeRoute.steps.map((step, idx) => (
                    <li
                      key={`${idx}-${step.distanceMeters}`}
                      className="flex items-start gap-2 text-xs text-slate-700"
                    >
                      <span className="w-5 h-5 rounded-full bg-white border border-[#B8DCE2] text-[#006272] font-semibold text-[11px] flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 leading-relaxed">
                        <span>{step.instruction}</span>
                        {step.distanceMeters > 0 && (
                          <span className="ml-1.5 text-slate-400 tabular-nums">
                            ({formatDistanceLabel(step.distanceMeters)})
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        {/* Selected Building Detail View */}
        {selectedBuilding ? (
          <section className="bg-white">
            <div className="p-4 border-b border-slate-200">
              <button
                type="button"
                onClick={() => onSelectBuilding(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#006272] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>캠퍼스 건물 목록으로</span>
              </button>

              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-[#006272]">
                      {selectedBuilding.zone}
                    </span>
                    {activeOrigin && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          직선 약{' '}
                          {formatDistanceLabel(
                            computeHaversineMeters(
                              activeOrigin,
                              selectedBuilding.location
                            )
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {selectedBuilding.name}
                  </h2>
                </div>
                <span className="w-8 h-8 rounded-lg bg-[#EAF4F6] text-[#006272] font-bold text-sm flex items-center justify-center shrink-0">
                  {selectedBuilding.shortCode}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {selectedBuilding.summary}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {selectedBuilding.address}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-medium text-slate-700">주요 공간</span>
                <span>{selectedBuilding.departments.join(' · ')}</span>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => onStartNavigation(selectedBuilding)}
                  className="w-full h-10 px-4 rounded-lg bg-[#006272] hover:bg-[#004D59] text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Navigation className="w-4 h-4" />
                  <span>이 건물로 도보 길 안내</span>
                </button>
              </div>
            </div>

            {/* Building Amenities */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  건물별 편의시설
                </h3>
                <span className="text-xs text-slate-500 tabular-nums">
                  {selectedBuilding.amenities.length}개 시설
                </span>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {selectedBuilding.amenities.map((amenity) => {
                  const isHighlighted =
                    activeAmenityFilter !== 'all' &&
                    amenity.category === activeAmenityFilter;
                  return (
                    <div
                      key={amenity.id}
                      className={`py-3 first:pt-1 last:pb-1 ${
                        isHighlighted
                          ? 'bg-[#EAF4F6]/40 -mx-2 px-2 rounded-lg'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {amenity.name}
                        </span>
                        <span className="text-xs font-medium text-[#006272] shrink-0">
                          {amenity.categoryLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                        <span>{amenity.floor}</span>
                        <span aria-hidden="true">·</span>
                        <span>{amenity.hours}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {amenity.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Related Notices */}
            {relatedNotices.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  관련 캠퍼스 공지
                </h3>
                <div className="mt-2.5 divide-y divide-slate-100">
                  {relatedNotices.map((notice) => (
                    <div
                      key={notice.id}
                      className="py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span
                          className={
                            notice.category === '긴급'
                              ? 'font-semibold text-amber-700'
                              : 'font-medium text-[#006272]'
                          }
                        >
                          {notice.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{notice.date}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-800">
                        {notice.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                        {notice.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          /* Building & Facility Directory List */
          <section className="divide-y divide-slate-100">
            <div className="px-4 py-2.5 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
              <span>
                {activeAmenityFilter === 'all'
                  ? '캠퍼스 주요 건물 및 시설'
                  : `${
                      AMENITY_FILTERS.find((f) => f.id === activeAmenityFilter)
                        ?.label
                    } 보유 건물`}
              </span>
              <span className="tabular-nums">
                {filteredBuildings.length}곳
              </span>
            </div>

            {filteredBuildings.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  검색 조건에 맞는 캠퍼스 시설이 없습니다.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  다른 검색어를 입력하거나 필터를 전체로 초기화해 보세요.
                </p>
                <button
                  type="button"
                  onClick={() => onAmenityFilterChange('all')}
                  className="mt-4 px-3.5 py-2 text-xs font-medium text-white bg-[#006272] hover:bg-[#004D59] rounded-lg transition-colors cursor-pointer"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              filteredBuildings.map((building) => {
                const matchingAmenities =
                  activeAmenityFilter === 'all'
                    ? building.amenities
                    : building.amenities.filter(
                        (a) => a.category === activeAmenityFilter
                      );
                const distanceMeters = activeOrigin
                  ? computeHaversineMeters(activeOrigin, building.location)
                  : null;

                return (
                  <div
                    key={building.id}
                    className="p-4 hover:bg-slate-50/90 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectBuilding(building.id)}
                        className="text-left min-w-0 flex-1 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-[#006272]">
                            {building.zone}
                          </span>
                          {distanceMeters !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {formatDistanceLabel(distanceMeters)} (도보 약{' '}
                                {estimateWalkingMinutes(distanceMeters)}분)
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="mt-1 text-base font-bold text-slate-900 group-hover:text-[#006272] transition-colors">
                          {building.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {matchingAmenities.length > 0
                            ? matchingAmenities
                                .map((a) => `${a.name} (${a.floor})`)
                                .join(' · ')
                            : building.summary}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStartNavigation(building)}
                        aria-label={`${building.name} 도보 길 안내`}
                        className="px-3 py-2 rounded-lg border border-slate-200 hover:border-[#006272] hover:bg-[#EAF4F6] text-xs font-medium text-[#006272] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>길 안내</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
    </aside>
  );
};
