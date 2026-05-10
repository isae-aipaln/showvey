import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Key } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

import showveyLogo from "@/assets/showvey-logo-new.png";

const LoginPage = () => {
  const { login } = useAppContext();
  const navigate = useNavigate();
  
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedId = id.trim();

    if (!trimmedId) {
      toast.error("아이디를 입력해주세요.");
      return;
    }

    if (!password) {
      toast.error("비밀번호를 입력해주세요.");
      return;
    }

    toast.loading("로그인 정보 확인 중...", { id: "login-check" });

    try {
      const userRef = doc(db, "users", trimmedId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.code === password) {
          toast.dismiss("login-check");
          
          let roleType = userData.role;
          let adminRole = null;
          
          if (roleType === "Master") {
            roleType = "ADMIN";
            adminRole = "Master";
          } else if (roleType === "Staff1") {
            roleType = "STAFF_1";
          } else if (roleType === "Staff2") {
            roleType = "STAFF_2";
          } else if (roleType === "Store") {
            roleType = "STORE";
          }

          login(userSnap.id, roleType, adminRole);

          toast.success(`${userSnap.id}님, 환영합니다!`);

          if (roleType === "ADMIN") {
            navigate("/admin/accounts");
          } else {
            navigate("/gallery");
          }
          return;
        }
      }

      toast.dismiss("login-check");
      toast.error("아이디 또는 비밀번호가 일치하지 않습니다.");
    } catch (error: any) {
      toast.dismiss("login-check");
      toast.error("로그인 중 오류가 발생했습니다.");
      console.error(error);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 py-6 font-sans antialiased text-foreground">
      {/* Header */}
      <div className="flex w-full max-w-xs mx-auto items-center justify-end">
        <button
          onClick={() => navigate("/admin-login")}
          className="p-1 text-muted-foreground/15 transition-colors hover:text-muted-foreground/80 active:opacity-60"
          title="Admin Access"
        >
          <Key className="h-5 w-5 stroke-[1.5]" />
        </button>
      </div>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center -mt-6">
        {/* Showvey logo */}
        <img src={showveyLogo} alt="Logo" className="h-[2.63rem] w-auto mb-2" />
        <p className="text-xs text-slate-400 tracking-wider mb-32">Online Survey Platform</p>

        {/* Login form */}
        <form onSubmit={handleLogin} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="text"
            placeholder="아이디 (이메일 또는 이름)"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
          <button
            type="submit"
            className="mt-3 h-12 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground transition-all hover:opacity-95 active:scale-[0.98] shadow-sm"
          >
            입장
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
