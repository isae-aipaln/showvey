import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Download, Monitor, Smartphone } from "lucide-react";
import DonePanel from "@/components/feed/DonePanel";
import ReviewerSidebar from "@/components/pc/ReviewerSidebar";
import { toast } from "sonner";
import { db, storage } from "@/firebase";
import { collection, query, where, getDocs, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { normalizeStyleNo } from "@/lib/utils";
import { exportCommentsToExcel } from "@/lib/exportComments";
import { getReviewStatus, type ReviewStatus } from "@/lib/evaluationSave";
import ReviewStatusLabel, { CARD_LABEL_HALO } from "@/components/ReviewStatusLabel";
import { useIsDesktop, useIsDesktopViewport, getForceMobile, setForceMobile } from "@/hooks/use-desktop";
import { useGridMetrics } from "@/hooks/use-grid-metrics";
import { PC_CONTAINER } from "@/components/pc/pcLayout";
import ResilientImage from "@/components/ResilientImage";
import MobileHome from "@/components/mobile/MobileHome";

const GalleryPage = () => {
  const { userRole, logout, products, evaluations, refreshData, userId } = useAppContext();
  const navigate = useNavigate();
  const [exitOpen, setExitOpen] = useState(false);
  // 나가기 팝업 2단계: 종료 확인(confirm) → 감사 인사(thanks)
  const [exitStep, setExitStep] = useState<"confirm" | "thanks">("confirm");
  // 사이드바 탭 (모바일 탭바와 동일: 홈 / 결과보기)
  const [activeTab, setActiveTab] = useState<"home" | "done">("home");
  // 사이드바 펼침 상태는 세션 동안 유지 (관리자 화면과 동일한 감각)
  const [sidebarOpen, setSidebarOpen] = useState(() => sessionStorage.getItem("gallerySidebar") !== "closed");
  useEffect(() => {
    sessionStorage.setItem("gallerySidebar", sidebarOpen ? "open" : "closed");
  }, [sidebarOpen]);

  const isDesktop = useIsDesktop();

  // 화면 폭에 맞춰 열 수를 실측 산출 (PC). 세로는 스크롤이므로 페이지 나눔이 없다
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const metrics = useGridMetrics(gridEl, isDesktop);

  // 상세를 보고 돌아오면 마지막으로 본 카드로 스크롤을 되돌린다 (스크롤 방식엔 페이지 번호가 없으므로)
  useEffect(() => {
    if (!gridEl || activeTab !== "home") return;
    const last = sessionStorage.getItem("lastViewedStyle");
    if (!last) return;
    const card = gridEl.querySelector(`[data-style="${CSS.escape(last)}"]`);
    card?.scrollIntoView({ block: "center" });
  }, [gridEl, activeTab, products.length]);

  // ADMIN은 첫 칸이 '+' 등록 카드
  const adminAddCard = isDesktop && userRole === "ADMIN";

  // PC↔모바일 화면 전환 버튼: 실제 화면 폭이 PC일 때만 노출 (전환 상태와 무관하게 항상 보여야 되돌릴 수 있음)
  const isDesktopViewport = useIsDesktopViewport();
  const [forceMobile, setForceMobileState] = useState(getForceMobile);
  const handleToggleView = () => {
    const next = !forceMobile;
    setForceMobile(next);
    setForceMobileState(next);
  };

  const routePrefix = "/staff-product";
  // ⭐ Fallback 제거: AppContext.userId를 단일 source of truth로 사용 (읽기 전용 — 평가 카운트 표시에만 사용)
  const currentUser = userId ?? "";

  // 품번별 진행 상태(미조회/조회 완료/평가 완료). 카드마다 전체 배열을 훑지 않도록 1회만 생성
  const statusMap = useMemo(() => {
    const map = new Map<string, ReviewStatus>();
    (evaluations as any[]).forEach((e) => {
      if (e.Evaluator_ID !== currentUser || !e.Style_no) return;
      map.set(normalizeStyleNo(String(e.Style_no)), getReviewStatus([e], String(e.Style_no), currentUser));
    });
    return map;
  }, [evaluations, currentUser]);
  const statusOf = (styleCode: string): ReviewStatus => statusMap.get(normalizeStyleNo(styleCode)) ?? "none";

  // 진행률은 '평가 완료'만 집계 (열람만 한 것은 아직 남은 일)
  const evaluatedCount = useMemo(
    () => products.filter((p) => statusOf(p.styleCode) === "done").length,
    [products, statusMap],
  );

  // 시작하기: 마지막으로 본 스타일이 있으면 이어보기, 없으면 첫 상품부터
  const lastViewed = sessionStorage.getItem("lastViewedStyle");
  const resumeProduct = lastViewed ? products.find((p) => p.styleCode === lastViewed) : undefined;
  const startLabel = resumeProduct ? "이어보기" : "시작하기";
  const handleStart = () => {
    const target = resumeProduct ?? products[0];
    if (target) navigate(`${routePrefix}/${target.styleCode}`);
  };

  const handleExit = () => {
    setExitOpen(false);
    logout();
    navigate("/");
  };
  const handleAdminComplete = () => {
    toast.success("모든 등록 사항이 저장되었습니다.");
    logout();
    navigate("/");
  };

  const handleDelete = async (e: React.MouseEvent, styleCode: string) => {
    e.stopPropagation();
    if (!window.confirm(`${styleCode}의 데이터를 초기화하시겠습니까?`)) return;

    try {
      toast.loading("데이터 초기화 중...", { id: "delete-process" });
      const sc = normalizeStyleNo(styleCode);

      const folderRef = ref(storage, `product_image/${sc}`);
      try {
        const fileList = await listAll(folderRef);
        await Promise.all(fileList.items.map(fileRef => deleteObject(fileRef)));
      } catch (e) {
        console.error("Storage delete error:", e);
      }

      const evalsRef = collection(db, "evaluations");
      const qEvals = query(evalsRef, where("Style_no", "==", sc));
      const evalSnapshot = await getDocs(qEvals);
      await Promise.all(evalSnapshot.docs.map(d => deleteDoc(d.ref)));

      const productRef = doc(db, "products", sc);
      await updateDoc(productRef, { Thumbnail_url: null, Product_image_urls: null, Coord_image_urls: null });
      toast.dismiss("delete-process");
      toast.success(`${sc} 데이터가 초기화되었습니다.`);
      refreshData();
    } catch (error) {
      toast.dismiss("delete-process");
      toast.error("초기화 중 오류가 발생했습니다.");
    }
  };

  const handleDownloadComments = async () => {
    if (!currentUser) {
      toast.error("로그인 정보가 없습니다.");
      return;
    }
    try {
      toast.loading("엑셀 파일 생성 중...", { id: "export-comments" });
      const { count } = await exportCommentsToExcel({
        evaluations: evaluations as any[],
        products: products as any[],
        evaluatorId: currentUser,
      });
      toast.dismiss("export-comments");
      toast.success(`${count}건의 메모를 엑셀로 내려받았습니다.`);
    } catch (err: any) {
      toast.dismiss("export-comments");
      toast.error(err?.message ?? "엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  // PC↔모바일 화면 전환 버튼 (모든 권한 공통, 실제 화면 폭이 PC일 때만 표시)
  const viewToggleButton = isDesktopViewport ? (
    <button
      onClick={handleToggleView}
      aria-label={forceMobile ? "PC 화면으로 전환" : "모바일 화면으로 전환"}
      title={forceMobile ? "PC 화면으로 전환" : "모바일 화면으로 전환"}
      className="flex h-[30px] w-[30px] items-center justify-center border border-foreground hover:bg-foreground hover:text-background"
    >
      {forceMobile ? <Monitor className="h-[18px] w-[18px]" /> : <Smartphone className="h-[18px] w-[18px]" />}
    </button>
  ) : null;

  // 모바일(또는 PC의 '모바일 화면 보기') + 비ADMIN → 인스타그램형 셸 (PC·ADMIN은 기존 UI 그대로)
  if (!isDesktop && userRole !== "ADMIN") {
    return <MobileHome />;
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-background">
      {/* PC 품평자: 관리자 화면과 동일한 좌측 사이드바 (홈·결과보기·로그아웃) */}
      {userRole !== "ADMIN" && (
        <ReviewerSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExit={() => setExitOpen(true)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className={`shrink-0 bg-background border-b border-muted ${userRole === "ADMIN" ? "p-4" : "flex h-14 items-center px-5"}`}>
        <div className={`flex w-full items-center gap-4 ${userRole === "ADMIN" ? "justify-between" : ""} ${PC_CONTAINER}`}>
        {userRole === "ADMIN" && (
          <div className="flex items-center gap-2">
            <div className="border border-foreground px-3 py-1 text-sm font-medium">Total {products.length}</div>
          </div>
        )}
        {userRole === "ADMIN" ? (
          <div className="flex items-center gap-2">
            {viewToggleButton}
            <button
              onClick={handleAdminComplete}
              className="border border-foreground px-3 py-1 text-sm font-bold text-center hover:bg-foreground hover:text-background"
            >
              수정 완료
            </button>
          </div>
        ) : (
          <>
          {/* 평가 진행률 — 사이드바가 좌측을 차지하므로 헤더 한 줄에 진행률과 액션을 함께 둔다 */}
          {activeTab === "home" && (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="h-[3px] max-w-md flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[hsl(var(--eval-blue))] transition-[width] duration-300"
                  style={{ width: `${products.length > 0 ? (evaluatedCount / products.length) * 100 : 0}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {evaluatedCount}
                <span className="text-muted-foreground/50"> / {products.length}</span>
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-4">
            {isDesktopViewport && (
              <button
                onClick={handleToggleView}
                aria-label={forceMobile ? "PC 화면으로 전환" : "모바일 화면으로 전환"}
                title={forceMobile ? "PC 화면으로 전환" : "모바일 화면으로 전환"}
                className="text-foreground hover:opacity-60"
              >
                {forceMobile ? <Monitor className="h-[22px] w-[22px]" strokeWidth={1.8} /> : <Smartphone className="h-[22px] w-[22px]" strokeWidth={1.8} />}
              </button>
            )}
            {/* 평가결과 다운로드는 '결과보기' 탭에서만 (공유 버튼은 제거) */}
            {userRole !== "STORE" && activeTab === "done" && (
              <button
                onClick={handleDownloadComments}
                className="flex items-center gap-1.5 rounded-lg border border-black/[0.12] px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.04]"
              >
                <Download className="h-4 w-4" strokeWidth={1.8} />
                평가결과 다운로드
              </button>
            )}
            {/* 종료 확인 다이얼로그 — 트리거는 하단 탭바의 '로그아웃' */}
            <Dialog open={exitOpen} onOpenChange={(open) => { setExitOpen(open); if (!open) setExitStep("confirm"); }}>
              <DialogContent className="flex max-w-xs flex-col items-center gap-6 rounded-2xl p-8">
                {exitStep === "confirm" ? (
                  <>
                    <p className="text-center text-sm font-medium">앱을 종료하시겠습니까?</p>
                    <div className="flex w-full gap-2">
                      <button
                        onClick={() => setExitStep("thanks")}
                        className="flex-1 rounded-full border border-foreground bg-background py-3 text-sm font-medium text-foreground"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setExitOpen(false)}
                        className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
                      >
                        취소
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-center text-sm font-medium">감사합니다.</p>
                    <button
                      onClick={handleExit}
                      className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
                    >
                      확인
                    </button>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
          </>
        )}
        </div>
      </div>

      {activeTab === "done" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={PC_CONTAINER}>
            <DonePanel onOpenEval={(p) => navigate(`${routePrefix}/${p.styleCode}`)} />
          </div>
        </div>
      ) : (
      <div ref={setGridEl} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div
          className={`grid grid-cols-2 gap-x-2 gap-y-3 content-start lg:gap-x-3 lg:gap-y-4 lg:justify-center ${PC_CONTAINER}`}
          style={isDesktop ? { gridTemplateColumns: `repeat(${metrics.cols}, ${metrics.cell}px)` } : undefined}
        >
          {adminAddCard && (
            <button
              onClick={() => navigate("/staff-product/new")}
              aria-label="스타일 등록"
              className="relative w-full aspect-[2/3] overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/30 bg-white flex items-center justify-center transition-colors hover:border-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              <Plus className="h-12 w-12 text-muted-foreground/50" />
            </button>
          )}
          {products.map((product, index) => {
            const status = statusOf(product.styleCode);
            // 갤러리 뱃지: 스타일팀 표시번호(예: 3, 12, 51-1)를 우선 표시, 없으면 목록 순번으로 폴백
            const badgeLabel = product.displayNo ? String(product.displayNo) : String(index + 1);
            return (
              <div key={product.id} data-style={product.styleCode} className="relative w-full aspect-[2/3]">
                <button
                  onClick={() => navigate(`${routePrefix}/${product.styleCode}`)}
                  className="group relative block h-full w-full overflow-hidden rounded-md bg-white text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                >
                  {product.thumbnailImage ? (
                    <ResilientImage
                      src={product.thumbnailImage}
                      alt={product.styleCode}
                      className="object-contain"
                      smartFill
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white">
                      {/* 이미지가 하나도 없을 때 품번 표시 (상품이미지, 코디이미지도 모두 없을 때) */}
                      {product.productImages.length === 0 && product.coordiImages.length === 0 ? (
                        <p className="text-sm font-bold text-foreground break-all px-3 text-center leading-snug">{product.styleCode}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">No Image</p>
                      )}
                    </div>
                  )}
                  {/* 순번은 상태와 무관한 고정 식별자라 항상 검정. 색으로 상태를 말하는 건 우측 라벨의 역할 */}
                  <span
                    className="absolute left-2 top-1.5 flex h-[18px] items-center text-[13px] font-bold leading-none tabular-nums text-foreground"
                    style={CARD_LABEL_HALO}
                  >
                    {badgeLabel}
                  </span>
                  <ReviewStatusLabel status={status} className="absolute right-2 top-1.5 h-[18px] text-[11px]" />
                </button>
                {userRole === "ADMIN" && (
                  <button
                    onClick={(e) => handleDelete(e, product.styleCode)}
                    aria-label={`${product.styleCode} 데이터 초기화`}
                    className="absolute bottom-2 left-2 z-10 rounded-md bg-white/90 p-1.5 shadow-sm transition-transform"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
      {/* 관리자는 기존 시작 버튼 유지 (품평자는 사이드바가 홈·결과보기·로그아웃을 담당) */}
      {userRole === "ADMIN" && (
        <div className="shrink-0 w-full border-t border-muted bg-background px-4 pt-4 pb-8 flex justify-center">
          <button
            onClick={handleStart}
            className="w-full max-w-md rounded-full bg-primary h-12 text-sm font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
          >
            {startLabel}
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default GalleryPage;
