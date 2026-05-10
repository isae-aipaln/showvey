import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { Heart, LayoutGrid, Square, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { db } from "@/firebase";
import { collection, query, where, getDocs, doc, setDoc, getDoc, limit, orderBy } from "firebase/firestore";
import { normalizeStyleNo } from "@/lib/utils";

const CoordiPage = () => {
  // ⭐ [수정] index 대신 styleCode 파라미터를 사용합니다.
  const { styleCode } = useParams<{ styleCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // ⭐ [수정] evaluations 데이터를 가져와 이전 상태를 복원합니다.
  const { products, userRole, evaluations, refreshData, updateEvaluation, userId, logout } = useAppContext();

  const evalId = new URLSearchParams(location.search).get("evalId");
  // ⭐ Fallback 제거: AppContext.userId를 단일 source of truth로 사용
  const currentUser = userId ?? "";

  // 전체 상품 리스트에서 현재 품번의 위치(index)를 찾습니다.
  const idx = products.findIndex((p) => p.styleCode === styleCode);
  const isAdminFlow = userRole === "ADMIN" && !evalId;

  const [viewMode, setViewMode] = useState<"gallery" | "single">("gallery");
  const [likedIndices, setLikedIndices] = useState<Set<number>>(new Set());
  const [coordImages, setCoordImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 1. 코디 이미지 리스트 가져오기 (테이블명: product_information)
  useEffect(() => {
    if (!styleCode) return;
    const fetchCoordImages = async () => {
      try {
        const productRef = doc(db, "products", normalizeStyleNo(styleCode));
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          setCoordImages(productSnap.data().Coord_image_urls || []);
        }
      } catch (err) {
        console.error("Error fetching coord images:", err);
      }
    };
    fetchCoordImages();
  }, [styleCode]);

  // 2. ⭐ Firestore에서 단일 evaluations 컬렉션으로부터 내 데이터를 꺼내옵니다.
  useEffect(() => {
    const fetchMyEvaluation = async () => {
      if (!styleCode || coordImages.length === 0) return;

      try {
        const evalsRef = collection(db, "evaluations");
        let q = query(evalsRef, where("Evaluator_ID", "==", currentUser));

        // 코디페이지는 styleCode 기준으로 가져오는 것이 가장 정확함
        q = query(q, where("Style_no", "==", normalizeStyleNo(styleCode)));

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const existingEval = snapshot.docs[0].data();
          const rawLiked = existingEval.Liked_images || [];
          let savedUrls: string[] = [];

          if (Array.isArray(rawLiked)) {
            savedUrls = rawLiked;
          } else if (typeof rawLiked === "string") {
            try {
              savedUrls = JSON.parse(rawLiked);
            } catch (e) {
              savedUrls = rawLiked
                .split(",")
                .map((s: string) => s.trim().replace(/['"\[\]{}]/g, ""))
                .filter(Boolean);
            }
          }

          const newIndices = new Set<number>();
          savedUrls.forEach((url: string) => {
            const decUrl = decodeURIComponent(url);
            const foundIdx = coordImages.findIndex((cUrl) => {
              const decCUrl = decodeURIComponent(cUrl);
              return decCUrl === decUrl || decCUrl.includes(decUrl) || decUrl.includes(decCUrl);
            });
            if (foundIdx !== -1) newIndices.add(foundIdx);
          });

          setLikedIndices(newIndices);
        } else {
          setLikedIndices(new Set());
        }
      } catch (err) {
        console.error("Firebase 평가 데이터 직접 호출 실패:", err);
      }
    };

    fetchMyEvaluation();
  }, [styleCode, coordImages, currentUser, evalId, userRole]);

  const toggleLike = (i: number) => {
    setLikedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleNextStep = async () => {
    if (isAdminFlow) {
      toast.success("스타일 등록이 완료되었습니다.");
      navigate("/gallery");
      return;
    }

    // ⭐ 저장 시점 가드: userId가 없으면 평가 저장 차단 + 로그인 페이지로 이동
    if (!currentUser || currentUser.trim() === "") {
      toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
      logout();
      navigate("/");
      return;
    }

    const currentProjectName = products[idx]?.projectId;

    try {
      toast.loading("평가를 저장 중입니다...", { id: "eval-final" });
      const likedUrls = Array.from(likedIndices).map((i) => coordImages[i]);

      // Firebase 'evaluations' 단일 컬렉션에 저장 (Evaluator_ID_Style_no를 문서 ID로 사용)
      const evalDocId = `${currentUser}_${normalizeStyleNo(styleCode!)}`;
      const evalRef = doc(db, "evaluations", evalDocId);

      await setDoc(
        evalRef,
        {
          Style_no: normalizeStyleNo(styleCode!),
          Evaluator_ID: currentUser,
          Liked_images: likedUrls,
          Project_name: currentProjectName,
        },
        { merge: true }
      );

      toast.dismiss("eval-final");
      toast.success("평가가 완료되었습니다!");

      updateEvaluation({
        Style_no: styleCode,
        Evaluator_ID: currentUser,
        Liked_images: likedUrls,
      });

      await refreshData();

      const nextIndex = idx + 1;
      if (nextIndex < products.length) {
        const nextProduct = products[nextIndex];
        const prefix = userRole === "GUEST" ? "/guest-product" : "/staff-product";
        navigate(`${prefix}/${nextProduct.styleCode}`);
      } else {
        toast("모든 품평을 마쳤습니다. 감사합니다!");
        navigate("/gallery");
      }
    } catch (err) {
      console.error("Final eval save error:", err);
      toast.dismiss("eval-final");
      toast.error("저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background p-4 border-b">
        <button onClick={() => setViewMode(viewMode === "gallery" ? "single" : "gallery")}>
          {viewMode === "gallery" ? <Square className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 font-medium">{styleCode}</div>
        <button onClick={() => navigate(-1)} className="text-sm font-medium">
          돌아가기
        </button>
      </div>

      <div className="flex-1 pb-40 px-2 pt-2">
        <div className={viewMode === "gallery" ? "grid grid-cols-2 gap-2" : "space-y-4"}>
          {coordImages.map((src, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden bg-white aspect-[2/3]">
              <img src={src} className="w-full h-full object-cover" alt={`coord-${i}`} />
              <button onClick={() => toggleLike(i)} className="absolute bottom-3 right-3">
                <Heart className={`h-8 w-8 ${likedIndices.has(i) ? "fill-black" : "text-black"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-background p-4 border-t z-50">
        <Button onClick={handleNextStep} className="w-full py-4 text-sm font-medium rounded-full">
          {isAdminFlow ? "스타일 등록 완료" : "다음 스타일 >"}
        </Button>
      </div>
    </div>
  );
};

export default CoordiPage;
