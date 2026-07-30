import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { normalizeStyleNo } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import SegmentedControl from "@/components/SegmentedControl";
import { DbProduct } from "@/components/ProductDetailShell";
import { StaffInfoSection } from "@/pages/StaffProductDetail";
import { useAppContext } from "@/context/AppContext";
import {
  buildEvalPayload,
  saveEvaluationMerge,
  mergeWithLocalEvaluation,
  findMyEvaluation,
} from "@/lib/evaluationSave";

// 세션 내 상품 상세 캐시 — 같은 상품 정보를 반복 조회하지 않음
const productCache = new Map<string, DbProduct>();

interface EvaluationSheetProps {
  product: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 상품정보 + 평가 통합 바텀시트: 상단 기본정보(STAFF_1은 원가 상세 포함, 열릴 때 지연 로드+캐시) → 하단 역할별 평가 + 총평.
// 저장: [저장] 버튼 또는 시트를 닫을 때 변경사항이 있으면 자동 저장 (기존 '이동 시 저장' UX의 번역)
const EvaluationSheet = ({ product, open, onOpenChange }: EvaluationSheetProps) => {
  const { userRole, userId, evaluations, updateEvaluation, markProductEvaluated, logout } = useAppContext();
  const navigate = useNavigate();
  const currentUser = userId ?? "";

  const [price, setPrice] = useState<string | undefined>(undefined);
  const [purchaseIntent, setPurchaseIntent] = useState<string | undefined>(undefined);
  const [orderCount, setOrderCount] = useState<string | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [dirty, setDirty] = useState(false);

  // 최신 evaluations 참조 (닫힘 시점 저장에서 stale 상태 방지)
  const evaluationsRef = useRef(evaluations);
  evaluationsRef.current = evaluations;

  // 상품 기본/상세정보: 열릴 때 해당 문서만 1회 로드 (세션 캐시)
  const [dbProduct, setDbProduct] = useState<DbProduct | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  useEffect(() => {
    if (!open || !product) return;
    const sc = normalizeStyleNo(product.styleCode);
    const cached = productCache.get(sc);
    if (cached) {
      setDbProduct(cached);
      return;
    }
    setDbProduct(null);
    setInfoLoading(true);
    getDoc(doc(db, "products", sc))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as DbProduct;
          productCache.set(sc, data);
          setDbProduct(data);
        }
      })
      .catch((err) => console.error("Error fetching product info:", err))
      .finally(() => setInfoLoading(false));
  }, [open, product]);

  // 시트가 열릴 때 기존 평가로 프리필
  useEffect(() => {
    if (!open || !product) return;
    const ex = findMyEvaluation(evaluations, product.styleCode, currentUser);
    setPrice(ex?.Price ?? undefined);
    setComment(ex?.Comment ?? "");
    setPurchaseIntent(userRole === "STAFF_2" ? ex?.Purchase_intent ?? undefined : undefined);
    setOrderCount(userRole === "STORE" ? ex?.Order_count ?? undefined : undefined);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.styleCode]);

  const ensureAuthed = () => {
    if (!currentUser || currentUser.trim() === "") {
      toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
      logout();
      navigate("/");
      return false;
    }
    return true;
  };

  const save = async (): Promise<boolean> => {
    if (!product || !dirty) return true;
    const { hasInput, payload } = buildEvalPayload(userRole, {
      styleCode: product.styleCode,
      userId: currentUser,
      projectName: product.projectId,
      price,
      purchaseIntent,
      orderCount,
      comment,
    });
    // 입력이 하나도 없으면 저장 스킵 (빈 평가 문서 방지 — 기존 규칙 유지)
    if (!hasInput) return true;
    if (!ensureAuthed()) return false;
    try {
      await saveEvaluationMerge(currentUser, product.styleCode, payload);
      updateEvaluation(mergeWithLocalEvaluation(evaluationsRef.current, currentUser, product.styleCode, payload));
      markProductEvaluated(product.id);
      return true;
    } catch {
      toast.error("평가 저장 중 오류가 발생했습니다.");
      return false;
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) void save(); // 스와이프로 닫아도 변경사항 유실 없음
    onOpenChange(next);
  };

  const handleSaveButton = async () => {
    const ok = await save();
    if (ok) {
      if (dirty) toast.success("평가가 저장되었습니다.");
      onOpenChange(false);
    }
  };

  const markDirty = () => setDirty(true);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-w-[430px] max-h-[85dvh]">
        <DrawerTitle className="px-4 pt-3 pb-1 text-center text-sm font-bold">
          {product?.styleCode}
        </DrawerTitle>
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
          {/* 상품 기본정보 (+ STAFF_1/ADMIN 원가 상세) */}
          {infoLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">상품정보 불러오는 중...</p>
          ) : (
            <StaffInfoSection drawerOpen={true} dbProduct={dbProduct} defaultDetailOpen={false} />
          )}
          <p className="mb-2 mt-1 text-[11px] font-medium text-muted-foreground">의견 작성</p>
          <div className="space-y-4">
            {userRole === "STAFF_2" && (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">가격</p>
                  <SegmentedControl
                    options={["저렴", "적정", "비쌈"]}
                    value={price}
                    onChange={(v) => { setPrice(v); markDirty(); }}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">구매의사</p>
                  <SegmentedControl
                    options={["보류", "관심", "구매함"]}
                    value={purchaseIntent}
                    onChange={(v) => { setPurchaseIntent(v); markDirty(); }}
                  />
                </div>
              </>
            )}
            {userRole === "STORE" && (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">가격</p>
                  <SegmentedControl
                    options={["저렴", "적정", "비쌈"]}
                    value={price}
                    onChange={(v) => { setPrice(v); markDirty(); }}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">예상판매수량</p>
                  <SegmentedControl
                    options={["2장이내", "5장이내", "10장이내"]}
                    value={orderCount}
                    onChange={(v) => { setOrderCount(v); markDirty(); }}
                  />
                </div>
              </>
            )}
            <textarea
              value={comment}
              onChange={(e) => { setComment(e.target.value); markDirty(); }}
              placeholder="총평을 남겨주세요 (선택 사항)"
              className="w-full h-24 rounded-xl border-0 bg-muted/60 p-3 text-sm resize-none placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button
              onClick={handleSaveButton}
              className="w-full rounded-[10px] bg-primary py-3 text-sm font-medium text-primary-foreground active:scale-[0.98]"
            >
              저장
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EvaluationSheet;
