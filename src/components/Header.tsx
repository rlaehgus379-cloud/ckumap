import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Bell, Compass, LocateFixed, Search, X} from 'lucide-react';
import {
  CampusBuilding,
  CampusNotice,
  GeolocationStatus,
  NoticeCategory,
} from '../types/campus';
import {NoticePopover} from './NoticePopover';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  buildings: CampusBuilding[];
  onSelectBuilding: (buildingId: string) => void;
  notices: CampusNotice[];
  readNoticeIds: Record<string, boolean>;
  onMarkNoticeRead: (id: string) => void;
  onMarkAllNoticesRead: () => void;
  geoStatus: GeolocationStatus;
  onLocateMe: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  buildings,
  onSelectBuilding,
  notices,
  readNoticeIds,
  onMarkNoticeRead,
  onMarkAllNoticesRead,
  geoStatus,
  onLocateMe,
}) => {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeCategory, setNoticeCategory] = useState<NoticeCategory>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => notices.filter((n) => !readNoticeIds[n.id]).length,
    [notices, readNoticeIds]
  );

  // Instant matches across buildings, zones, departments, and floor amenities
  const localMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return buildings
      .map((b) => {
        const matchedAmenities = b.amenities.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.categoryLabel.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        );
        const buildingHit =
          b.name.toLowerCase().includes(q) ||
          b.zone.toLowerCase().includes(q) ||
          b.departments.some((d) => d.toLowerCase().includes(q));
        if (!buildingHit && matchedAmenities.length === 0) return null;
        return {
          building: b,
          matchedAmenities,
        };
      })
      .filter(Boolean)
      .slice(0, 7) as Array<{
      building: CampusBuilding;
      matchedAmenities: CampusBuilding['amenities'];
    }>;
  }, [buildings, searchQuery]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const showDropdown =
    searchFocused && searchQuery.trim().length > 0 && localMatches.length > 0;

  return (
    <header className="relative z-40 bg-white border-b border-slate-200 px-3 sm:px-5 h-16 flex items-center justify-between gap-3 sm:gap-8">
      {/* Zone 1: Clean single-line brand wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSearchChange('');
        }}
        className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006272] rounded-md"
      >
        <span className="w-8 h-8 rounded-lg bg-[#006272] text-white flex items-center justify-center shrink-0">
          <Compass className="w-4 h-4" />
        </span>
        <span className="hidden md:inline text-base font-bold tracking-tight text-slate-900">
          가톨릭관동대 캠퍼스 가이드
        </span>
        <span className="md:hidden text-sm font-bold tracking-tight text-slate-900">
          CKU 가이드
        </span>
      </a>

      {/* Zone 2: Teal Notice Bell Icon directly to the LEFT of the Campus Search Bar */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 max-w-xl min-w-0">
        <div className="relative shrink-0">
          <button
            type="button"
            data-notice-bell-trigger="true"
            onClick={() => {
              setNoticeOpen((prev) => !prev);
              setSearchFocused(false);
            }}
            aria-label={`캠퍼스 공지사항 알림 (${unreadCount}건 미확인)`}
            aria-expanded={noticeOpen}
            className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006272] ${
              noticeOpen
                ? 'bg-[#EAF4F6] border-[#006272]/40 text-[#006272]'
                : 'bg-white border-slate-200 text-[#006272] hover:bg-[#EAF4F6]/60 hover:border-[#006272]/35'
            }`}
          >
            <Bell className="w-5 h-5 fill-[#006272]/15 stroke-[#006272]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#006272] text-white text-[10px] font-semibold leading-[18px] text-center tabular-nums ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <NoticePopover
            isOpen={noticeOpen}
            onClose={() => setNoticeOpen(false)}
            notices={notices}
            readNoticeIds={readNoticeIds}
            activeCategory={noticeCategory}
            onCategoryChange={setNoticeCategory}
            onMarkRead={onMarkNoticeRead}
            onMarkAllRead={onMarkAllNoticesRead}
            onJumpToBuilding={onSelectBuilding}
          />
        </div>

        <div ref={searchWrapperRef} className="relative flex-1 min-w-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setSearchFocused(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchFocused(false);
                } else if (e.key === 'Enter' && localMatches.length > 0) {
                  onSelectBuilding(localMatches[0].building.id);
                  setSearchFocused(false);
                }
              }}
              placeholder="건물명, 카페, 식당, 편의점, 열람실 검색"
              aria-label="학교 내 시설 검색"
              className="w-full h-10 pl-9 pr-9 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#006272] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="검색어 지우기"
                className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-3.5 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
                교내 건물 · 편의시설 검색 결과
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto cku-scroll">
                {localMatches.map(({building, matchedAmenities}) => (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => {
                      onSelectBuilding(building.id);
                      setSearchFocused(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#EAF4F6]/50 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {building.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {matchedAmenities.length > 0
                          ? matchedAmenities.map((a) => a.name).join(' · ')
                          : `${building.zone} · ${building.departments
                              .slice(0, 2)
                              .join(', ')}`}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[#006272] shrink-0 mt-0.5">
                      이동
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Single primary location action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onLocateMe}
          className="h-10 px-3 sm:px-4 rounded-lg bg-[#006272] hover:bg-[#004D59] text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006272]"
        >
          <LocateFixed className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">
            {geoStatus === 'locating' ? '위치 확인 중' : '내 위치'}
          </span>
        </button>
      </div>
    </header>
  );
};
