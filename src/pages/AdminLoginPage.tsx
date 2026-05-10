import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

const AdminLoginPage = () => {
  const [adminId, setAdminId] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAppContext();
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userRef = doc(db, "users", adminId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || userSnap.data().code !== adminCode || userSnap.data().role !== "Master") {
        toast.error("관리자 정보가 일치하지 않습니다.");
        return;
      }
      
      const userData = userSnap.data();

      login(userSnap.id, "ADMIN", "Master");
      toast.success(`관리자 권한으로 인증되었습니다.`);

      // ⭐ 목적지를 /admin/dashboard에서 /admin/evaluations(품평관리)로 변경
      navigate("/admin/evaluations");
    } catch (err) {
      toast.error("인증 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs">
        <h1 className="mb-8 text-center text-xl font-bold tracking-tight text-foreground">관리자 인증</h1>

        <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="관리자 ID"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            required
          />
          <input
            type="password"
            placeholder="인증 코드"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 h-12 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground transition-all hover:opacity-95 active:scale-[0.98] shadow-sm disabled:opacity-50"
          >
            {isLoading ? "인증 중..." : "입장"}
          </button>
        </form>

        <button
          onClick={() => navigate("/")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:underline"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default AdminLoginPage;
