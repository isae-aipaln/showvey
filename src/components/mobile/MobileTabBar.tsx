import { Home, ClipboardCheck, LogOut } from "lucide-react";

export type MobileTab = "home" | "done";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onExit: () => void;
}

// iOS 탭바 스타일: 반투명 + 배경 블러, 아이콘 + 소형 라벨
// 주의: fixed bottom-0 left-0 w-full 클래스 조합은 index.css의 force-mobile 430px 중앙정렬 규칙과 매칭되므로 변경 금지
const MobileTabBar = ({ activeTab, onTabChange, onExit }: MobileTabBarProps) => (
  <nav className="fixed bottom-0 left-0 w-full z-30 border-t border-black/10 bg-white/85 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
    <div className="flex h-[3.25rem] items-center justify-around">
      <button
        onClick={() => onTabChange("home")}
        aria-label="홈"
        className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 ${
          activeTab === "home" ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        <Home className="h-[22px] w-[22px]" strokeWidth={activeTab === "home" ? 2.2 : 1.6} />
        <span className={`text-[10px] leading-none ${activeTab === "home" ? "font-medium" : ""}`}>홈</span>
      </button>
      <button
        onClick={() => onTabChange("done")}
        aria-label="완료현황"
        className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 ${
          activeTab === "done" ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        <ClipboardCheck className="h-[22px] w-[22px]" strokeWidth={activeTab === "done" ? 2.2 : 1.6} />
        <span className={`text-[10px] leading-none ${activeTab === "done" ? "font-medium" : ""}`}>완료</span>
      </button>
      <button
        onClick={onExit}
        aria-label="나가기"
        className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground"
      >
        <LogOut className="h-[22px] w-[22px]" strokeWidth={1.6} />
        <span className="text-[10px] leading-none">나가기</span>
      </button>
    </div>
  </nav>
);

export default MobileTabBar;
