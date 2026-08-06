import { Menu, Home, ClipboardCheck, LogOut } from "lucide-react";
import showveyLogo from "@/assets/showvey-logo-new.png";

export type ReviewerTab = "home" | "done";

interface ReviewerSidebarProps {
  open: boolean;
  onToggle: () => void;
  activeTab: ReviewerTab;
  onTabChange: (tab: ReviewerTab) => void;
  onExit: () => void;
}

const NAV_ITEMS: { tab: ReviewerTab; label: string; icon: typeof Home }[] = [
  { tab: "home", label: "홈", icon: Home },
  { tab: "done", label: "결과보기", icon: ClipboardCheck },
];

// PC 품평자 사이드바 — 관리자 사이드바(AdminSidebar)와 동일한 톤·간격·상호작용을 따른다.
// 모바일은 하단 탭바(MobileTabBar)를 그대로 쓰므로 이 컴포넌트는 PC 전용이다.
const ReviewerSidebar = ({ open, onToggle, activeTab, onTabChange, onExit }: ReviewerSidebarProps) => (
  <aside
    className={`flex shrink-0 flex-col justify-between border-r border-border bg-muted/50 transition-all duration-300 ${
      open ? "w-56" : "w-16"
    }`}
  >
    <div>
      <div className={`flex h-14 items-center border-b border-border ${open ? "justify-between pl-4 pr-2" : "justify-center"}`}>
        {open && <img src={showveyLogo} alt="SHOWVEY" className="h-5 w-auto" />}
        <button
          onClick={onToggle}
          aria-label={open ? "사이드바 접기" : "사이드바 펼치기"}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
      </div>
      <nav className="mt-4 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              title={open ? undefined : label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
              } ${open ? "" : "justify-center"}`}
            >
              <Icon size={18} strokeWidth={1.5} className="shrink-0" />
              {open && <span>{label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
    <div className="mb-4 flex flex-col gap-1 border-t border-border px-2 pt-4">
      <button
        onClick={onExit}
        title={open ? undefined : "로그아웃"}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground ${
          open ? "" : "justify-center"
        }`}
      >
        <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
        {open && <span>로그아웃</span>}
      </button>
    </div>
  </aside>
);

export default ReviewerSidebar;
