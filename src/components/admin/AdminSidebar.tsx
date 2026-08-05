import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Lock, Shirt, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/context/AppContext";

interface AdminSidebarProps {
  open: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { path: "/admin/accounts", label: "계정관리", icon: Lock },
  { path: "/admin/evaluations", label: "품평관리", icon: Shirt },
];

// 관리자 공통 사이드바 — 밝은 톤(Finder/메일앱 스타일), 품평자 화면과 동일한 디자인 토큰 사용
const AdminSidebar = ({ open, onToggle }: AdminSidebarProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { logout } = useAppContext();

  const handleLogout = () => {
    logout();
    toast.success("로그아웃 되었습니다.");
    navigate("/");
  };

  return (
    <aside
      className={`flex shrink-0 flex-col justify-between border-r border-border bg-muted/50 transition-all duration-300 ${
        open ? "w-56" : "w-16"
      }`}
    >
      <div>
        <div className="flex h-14 items-center justify-center border-b border-border">
          <button
            onClick={onToggle}
            aria-label={open ? "사이드바 접기" : "사이드바 펼치기"}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
        </div>
        <nav className="mt-4 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            // /admin/evaluations/:id 같은 하위 경로도 상위 메뉴가 활성으로 보이게
            const active = pathname === path || pathname.startsWith(`${path}/`);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={open ? undefined : label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                }`}
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
          onClick={handleLogout}
          title={open ? undefined : "로그아웃"}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
        >
          <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
          {open && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
