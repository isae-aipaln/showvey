import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { Menu, Home, Lock, Shirt, LogOut, Bell, PlusCircle } from "lucide-react";
import { toast } from "sonner";

const AdminDashboard = () => {
  const { logout } = useAppContext();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success("로그아웃 되었습니다.");
    navigate("/");
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans antialiased text-slate-900 transition-all duration-300">
      {/* 1. 왼쪽 사이드바 (규격 통일: w-56) */}
      <aside
        className={`flex flex-col justify-between bg-slate-900 text-white transition-all duration-300 ${
          isSidebarOpen ? "w-56" : "w-16"
        }`}
      >
        {/* 상단: 햄버거 메뉴 (규격 통일: h-14) */}
        <div>
          <div className="flex h-14 items-center px-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-md p-2 hover:bg-slate-800 transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>

          {/* 메뉴 영역: HOME 숨김 유지 */}
          <nav className="mt-4 flex flex-col gap-1 px-2">
            {/* <button
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <Home size={18} className="shrink-0" />
              {isSidebarOpen && <span>HOME</span>}
            </button> 
            */}

            <button
              onClick={() => navigate("/admin/accounts")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Lock size={18} className="shrink-0" />
              {isSidebarOpen && <span>계정관리</span>}
            </button>

            <button
              onClick={() => navigate("/admin/evaluations")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Shirt size={18} className="shrink-0" />
              {isSidebarOpen && <span>품평관리</span>}
            </button>
          </nav>
        </div>

        {/* 하단 영역 - ⭐ 설정 버튼 제거 완료 */}
        <div className="mb-4 flex flex-col gap-1 px-2 border-t border-slate-700 pt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            {isSidebarOpen && <span>로그아웃</span>}
          </button>
        </div>
      </aside>

      {/* 2. 우측 메인 컨텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 상단 헤더 (규격 통일: h-14, text-lg) */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 hover:bg-slate-100 transition-colors">
              <Bell size={20} className="text-slate-600" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
          </div>
        </header>

        {/* 메인 스크롤 영역 */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* 진행 중인 품평 카드 */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center text-center">
              <p className="text-sm font-medium text-slate-500">진행 중인 품평</p>
              <p className="mt-4 text-5xl font-bold text-slate-900">1</p>
              <span className="mt-6 inline-block rounded-lg bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-500 border border-slate-200">
                진행중
              </span>
            </div>
          </div>

          {/* 새로운 품평 생성 버튼 */}
          <button className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-slate-400 transition-all hover:border-slate-400 hover:text-slate-600 group shadow-sm">
            <PlusCircle size={28} className="group-hover:scale-110 transition-transform" />
            <span className="text-lg font-bold">새로운 품평 생성</span>
          </button>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
