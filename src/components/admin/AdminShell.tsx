import { useState } from "react";
import AdminSidebar from "./AdminSidebar";

const SIDEBAR_KEY = "adminSidebarOpen";

interface AdminShellProps {
  title: string;
  /** 헤더 좌측 슬롯 — 제목 앞에 오는 뒤로가기 버튼 등 */
  headerLeft?: React.ReactNode;
  /** 헤더 우측 슬롯 (주 액션 버튼 등) */
  headerRight?: React.ReactNode;
  /** true면 main이 남은 높이를 채우는 flex 컨테이너가 됨 — 자체 스크롤 영역이 필요한 페이지(품평 상세)용 */
  fill?: boolean;
  children: React.ReactNode;
}

// 관리자 페이지 공통 셸 (사이드바 + 헤더 + main).
// 사이드바 접힘 상태는 localStorage에 저장 — 페이지를 이동하거나 새로고침해도 유지됨
const AdminShell = ({ title, headerLeft, headerRight, fill, children }: AdminShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof localStorage === "undefined" || localStorage.getItem(SIDEBAR_KEY) !== "0",
  );

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full bg-background font-sans text-foreground antialiased">
      <AdminSidebar open={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 툴바 — 페이지 제목과 전역 액션을 한 줄에 모음 (macOS 프로 앱 문법) */}
        {/* 툴바 좌측 요소(뒤로가기)의 왼쪽 끝이 아래 카드의 좌측 선(px-8)과 맞도록 동일한 패딩 사용 */}
        <header className="z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-8 backdrop-blur-md">
          {headerLeft}
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <div className="ml-auto flex items-center gap-2">{headerRight}</div>
        </header>
        <main
          className={
            fill ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40 p-8" : "flex-1 overflow-y-auto bg-muted/40 p-8"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
