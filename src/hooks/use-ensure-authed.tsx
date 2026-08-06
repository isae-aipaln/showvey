import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppContext } from "@/context/AppContext";

// 저장 시점 세션 가드 — userId가 없으면 저장을 막고 로그인 페이지로 되돌린다.
// PC 상세(ProductDetailShell)와 모바일 평가 시트가 공유
export function useEnsureAuthed() {
  const { userId, logout } = useAppContext();
  const navigate = useNavigate();

  return useCallback(() => {
    if (!userId || userId.trim() === "") {
      toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
      logout();
      navigate("/");
      return false;
    }
    return true;
  }, [userId, logout, navigate]);
}
