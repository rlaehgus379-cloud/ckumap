import React, {useEffect, useRef} from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCheck,
  GraduationCap,
  MapPin,
  Wrench,
  X,
} from 'lucide-react';
import {CampusNotice, NoticeCategory} from '../types/campus';

interface NoticePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notices: CampusNotice[];
  readNoticeIds: Record<string, boolean>;
  activeCategory: NoticeCategory;
  onCategoryChange: (cat: NoticeCategory) => void;
  onMarkRead: (noticeId: string) => void;
  onMarkAllRead: () => void;
  onJumpToBuilding: (buildingId: string) => void;
}

const NOTICE_CATEGORIES: {id: NoticeCategory; label: string}[] = [
  {id: 'all', label: '전체'},
  {id: '긴급', label: '긴급'},
  {id: '시설', label: '시설'},
  {id: '학사', label: '학사'},
  {id: '행사', label: '행사'},
];

function getCategoryIcon(category: CampusNotice['category']) {
  switch (category) {
    case '긴급':
      return <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />;
    case '시설':
      return <Wrench className="w-4 h-4 text-[#006272] shrink-0" />;
    case '학사':
      return <GraduationCap className="w-4 h-4 text-slate-700 shrink-0" />;
    case '행사':
      return <Calendar className="w-4 h-4 text-slate-700 shrink-0" />;
  }
}

export const NoticePopover: React.FC<NoticePopoverProps> = ({
  isOpen,
  onClose,
  notices,
  readNoticeIds,
  activeCategory,
  onCategoryChange,
  onMarkRead,
  onMarkAllRead,
  onJumpToBuilding,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !target.closest('[data-notice-bell-trigger="true"]')
      ) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotices =
    activeCategory === 'all'
      ? notices
      : notices.filter((n) => n.category === activeCategory);

  const unreadCount = notices.filter((n) => !readNoticeIds[n.id]).length;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="캠퍼스 공지사항 알림"
      className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[420px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            캠퍼스 공지사항
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            미확인 {unreadCount}건
          </span>
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#006272] hover:bg-[#EAF4F6] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>모두 읽음</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="공지창 닫기"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {NOTICE_CATEGORIES.map((cat) => {
            const count =
              cat.id === 'all'
                ? notices.filter((n) => !readNoticeIds[n.id]).length
                : notices.filter(
                    (n) => n.category === cat.id && !readNoticeIds[n.id]
                  ).length;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#006272] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
                {count > 0 && (
                  <span className="ml-1 text-[11px] tabular-nums opacity-75">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto cku-scroll divide-y divide-slate-100">
        {filteredNotices.length === 0 ? (
          <div className="py-10 px-4 text-center text-sm text-slate-500">
            해당 카테고리에 등록된 공지사항이 없습니다.
          </div>
        ) : (
          filteredNotices.map((notice) => {
            const isUnread = !readNoticeIds[notice.id];
            return (
              <div
                key={notice.id}
                onClick={() => onMarkRead(notice.id)}
                className={`px-4 py-3.5 transition-colors cursor-pointer ${
                  isUnread
                    ? 'bg-[#EAF4F6]/45 hover:bg-[#EAF4F6]/75'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getCategoryIcon(notice.category)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5 truncate">
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
                        {isUnread && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#006272]">
                              새 알림
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <p
                      className={`mt-1 text-sm leading-snug ${
                        isUnread
                          ? 'font-semibold text-slate-900'
                          : 'font-medium text-slate-700'
                      }`}
                    >
                      {notice.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {notice.summary}
                    </p>

                    {notice.buildingId && notice.buildingName && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(notice.id);
                            onJumpToBuilding(notice.buildingId!);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#006272] hover:text-[#004D59] hover:underline cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{notice.buildingName} 위치 보기</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          가톨릭관동대학교 캠퍼스 안내
        </span>
        <span className="tabular-nums">총 {notices.length}건</span>
      </div>
    </div>
  );
};
