import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Download, Share2, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/context/AppContext";
import { exportCommentsToExcel, shareCommentsExcel } from "@/lib/exportComments";
import { useIsDesktopViewport, getForceMobile, setForceMobile } from "@/hooks/use-desktop";
import { getReviewStatus } from "@/lib/evaluationSave";
import ReviewStatusLabel, { CARD_LABEL_HALO } from "@/components/ReviewStatusLabel";
import ResilientImage from "@/components/ResilientImage";
import MobileTabBar, { MobileTab } from "./MobileTabBar";
import ExitDialog from "./ExitDialog";
import FeedList from "@/components/feed/FeedList";
import EvaluationSheet from "@/components/feed/EvaluationSheet";
import DonePanel from "@/components/feed/DonePanel";
import showveyLogo from "@/assets/showvey-logo-new.png";

// 모바일(비ADMIN) 전용 인스타그램형 셸.
// 홈 탭 = 갤러리 그리드 → 썸네일 탭 시 그 상품부터 이어지는 포스트 피드 / 완료현황 탭 / 나가기.
// PC·ADMIN은 기존 GalleryPage가 그대로 렌더된다 (GalleryPage 상단 분기 참조)
const MobileHome = () => {
  const { userRole, logout, products, evaluations, userId } = useAppContext();
  const navigate = useNavigate();
  const currentUser = userId ?? "";

  const [activeTab, setActiveTab] = useState<MobileTab>("home");
  const [feedStartIndex, setFeedStartIndex] = useState<number | null>(null); // null = 그리드
  const [exitOpen, setExitOpen] = useState(false);
  const [evalTarget, setEvalTarget] = useState<any | null>(null);
  const [evalOpen, setEvalOpen] = useState(false);

  const evaluatedCount = products.filter(
    (p) => getReviewStatus(evaluations, p.styleCode, currentUser) === "done",
  ).length;

  // 화면(그리드/피드/완료현황) 전환 시 각 화면의 스크롤 위치 저장·복원
  const surface = activeTab === "done" ? "done" : feedStartIndex !== null ? "feed" : "grid";
  const scrollPos = useRef<Record<string, number>>({});
  const prevSurface = useRef(surface);
  useLayoutEffect(() => {
    if (prevSurface.current !== surface) {
      scrollPos.current[prevSurface.current] = window.scrollY;
      window.scrollTo(0, scrollPos.current[surface] ?? 0);
      prevSurface.current = surface;
    }
  }, [surface]);

  const openFeedAt = (index: number) => {
    scrollPos.current["feed"] = 0; // 새 진입은 항상 피드 최상단부터
    setFeedStartIndex(index);
  };

  const handleTabChange = (tab: MobileTab) => {
    if (tab === "home" && activeTab === "home" && feedStartIndex !== null) {
      setFeedStartIndex(null); // 피드에서 홈 탭 재탭 → 그리드 복귀
      return;
    }
    setActiveTab(tab);
  };

  const handleExit = () => {
    setExitOpen(false);
    logout();
    navigate("/");
  };

  const handleOpenEval = (product: any) => {
    setEvalTarget(product);
    setEvalOpen(true);
  };

  // 메모 엑셀 다운로드/공유 (기존 갤러리 헤더 기능 유지, STORE 제외)
  const handleDownloadComments = async () => {
    if (!currentUser) return void toast.error("로그인 정보가 없습니다.");
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
  const handleShareComments = async () => {
    if (!currentUser) return void toast.error("로그인 정보가 없습니다.");
    try {
      toast.loading("엑셀 파일 생성 중...", { id: "share-comments" });
      const { count, method } = await shareCommentsExcel({
        evaluations: evaluations as any[],
        products: products as any[],
        evaluatorId: currentUser,
      });
      toast.dismiss("share-comments");
      toast.success(method === "share" ? `${count}건의 메모를 공유했습니다.` : `공유를 지원하지 않아 ${count}건의 메모를 다운로드했습니다.`);
    } catch (err: any) {
      toast.dismiss("share-comments");
      if (err?.name === "AbortError") return;
      toast.error(err?.message ?? "공유 중 오류가 발생했습니다.");
    }
  };

  // PC 화면 폭에서 강제 모바일 보기 중일 때 PC로 되돌아가는 토글
  const isDesktopViewport = useIsDesktopViewport();
  const [forceMobileOn, setForceMobileOn] = useState(getForceMobile);
  const handleToggleView = () => {
    const next = !forceMobileOn;
    setForceMobile(next);
    setForceMobileOn(next);
  };

  const inFeed = surface === "feed";

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      {/* 상단 앱바 */}
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/85 backdrop-blur-md">
        <div className="flex h-12 items-center px-3">
          {inFeed ? (
            <>
              <button onClick={() => setFeedStartIndex(null)} aria-label="갤러리로 돌아가기" className="-ml-1 p-1">
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          ) : (
            <>
              <img src={showveyLogo} alt="SHOWVEY" className="h-5 w-auto" />
              <div className="ml-auto flex items-center gap-3">
                {isDesktopViewport && (
                  <button onClick={handleToggleView} aria-label={forceMobileOn ? "PC 화면으로 전환" : "모바일 화면으로 전환"}>
                    {forceMobileOn ? (
                      <Monitor className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    ) : (
                      <Smartphone className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    )}
                  </button>
                )}
                {activeTab === "home" && userRole !== "STORE" && (
                  <>
                    <button onClick={handleShareComments} aria-label="메모 엑셀 공유">
                      <Share2 className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    </button>
                    <button onClick={handleDownloadComments} aria-label="메모 엑셀 다운로드">
                      <Download className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {/* 평가 진행률: 헤더에 고정되어 스크롤해도 항상 표시 */}
        {surface === "grid" && (
          <div className="flex items-center gap-2.5 px-3.5 pb-2.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[hsl(var(--eval-blue))] transition-[width] duration-300"
                style={{ width: `${products.length > 0 ? (evaluatedCount / products.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {evaluatedCount}
              <span className="text-muted-foreground/50"> / {products.length}</span>
            </span>
          </div>
        )}
      </header>

      {/* 홈 탭: 그리드 or 피드 */}
      {activeTab === "home" && (
        <>
          {surface === "grid" && (
            <div className="pb-2">
              {/* 인스타 탐색탭 스타일: 3열 엣지투엣지, 회색 배경이 1px 간격으로 비쳐 경계선 역할.
                  흰 배경 썸네일끼리 붙어도 경계가 보이도록 구분선 색을 한 단계 진하게 */}
              <div className="grid grid-cols-3 gap-[1px] border-y border-[#e2e2e0] bg-[#e2e2e0]">
                {products.map((product, index) => {
                  const status = getReviewStatus(evaluations, product.styleCode, currentUser);
                  const badgeLabel = product.displayNo ? String(product.displayNo) : String(index + 1);
                  // 갤러리 대표컷 = 썸네일 (2026-08 회의 확정안)
                  const gridImage = product.thumbnailImage;
                  return (
                    <div
                      key={product.id}
                      onClick={() => openFeedAt(index)}
                      className="relative w-full aspect-[2/3] cursor-pointer overflow-hidden bg-white"
                    >
                      {gridImage ? (
                        <ResilientImage
                          src={gridImage}
                          alt={product.styleCode}
                          className="object-contain"
                          smartFill
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/30">
                          {product.productImages.length === 0 && product.coordiImages.length === 0 ? (
                            <p className="text-xs font-bold text-foreground break-all px-2 text-center leading-snug">
                              {product.styleCode}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">No Image</p>
                          )}
                        </div>
                      )}
                      {/* 순번은 상태와 무관한 고정 식별자라 항상 검정 (PC 갤러리와 동일 규칙) */}
                      <span
                        className="absolute left-2 top-1.5 flex h-[18px] items-center text-[13px] font-bold leading-none tabular-nums text-foreground"
                        style={CARD_LABEL_HALO}
                      >
                        {badgeLabel}
                      </span>
                      <ReviewStatusLabel status={status} className="absolute right-1.5 top-1.5 h-[16px] text-[10px]" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {inFeed && feedStartIndex !== null && (
            <FeedList products={products} startIndex={feedStartIndex} onOpenSheet={handleOpenEval} />
          )}
        </>
      )}

      {/* 완료현황 탭 */}
      {activeTab === "done" && <DonePanel onOpenEval={handleOpenEval} />}

      <MobileTabBar activeTab={activeTab} onTabChange={handleTabChange} onExit={() => setExitOpen(true)} />
      <ExitDialog open={exitOpen} onOpenChange={setExitOpen} onExit={handleExit} />
      <EvaluationSheet product={evalTarget} open={evalOpen} onOpenChange={setEvalOpen} />
    </div>
  );
};

export default MobileHome;
