import { useEffect, useRef, useState } from "react";
import { ChevronRight, Heart, Info } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/context/AppContext";
import { useInView } from "@/hooks/use-in-view";
import { normalizeStyleNo } from "@/lib/utils";
import { saveEvaluationMerge, mergeWithLocalEvaluation, findMyEvaluation, isEvaluated } from "@/lib/evaluationSave";
import FeedImageCarousel from "./FeedImageCarousel";

// 상품설명을 문장 단위로 줄바꿈 (StaffInfoSection과 동일 규칙)
const splitSentences = (text?: string | null): string[] =>
  (text || "").split(/(?<=[.!?])\s+|(?<=니다)\s+/).map((s) => s.trim()).filter(Boolean);

interface FeedPostProps {
  product: any;
  sequenceNumber: number;
  onOpenSheet: (product: any) => void;
}

// 인스타그램 포스트 1개: 헤더(품번+순번) / 이미지 캐러셀(핀치줌) / 말풍선(정보+평가 통합 시트) / 캡션.
// 좋아요(하트·더블탭)는 코디이미지 슬라이드에서만 동작 — 이미지 우측 하단 오버레이
const FeedPost = ({ product, sequenceNumber, onOpenSheet }: FeedPostProps) => {
  const { evaluations, userId, userRole, updateEvaluation } = useAppContext();
  const currentUser = userId ?? "";

  // 뷰포트 600px 근처에 들어오면 나머지 캐러셀 이미지 마운트 (그 전에는 첫 이미지만)
  const { ref: postRef, inView: nearViewport } = useInView<HTMLDivElement>({ rootMargin: "600px", once: true });

  const badgeLabel = product.displayNo ? String(product.displayNo) : String(sequenceNumber);
  // 피드 슬라이드 = [단품 → 코디] 순서 + 하단 썸네일 스트립 (2026-08 회의 확정안).
  // 썸네일 필드는 갤러리 그리드 전용 — 단품에 중복 등록되므로 피드에서 제외해 중복 차단
  let images: string[] = Array.from(
    new Set([...(product.productImages ?? []), ...(product.coordiImages ?? [])].filter(Boolean)),
  );
  // 단품·코디가 하나도 없는 상품만 썸네일로 대체
  if (images.length === 0 && product.thumbnailImage) images = [product.thumbnailImage];
  const showStrip = images.length > 1;

  const [activeIndex, setActiveIndex] = useState(0);
  const currentUrl = images[Math.min(activeIndex, Math.max(images.length - 1, 0))];

  // 좋아요: 모든 이미지 URL 단위 (evaluations.Liked_images) — 하트 즉시 저장(디바운스)
  const [likedUrls, setLikedUrls] = useState<Set<string>>(new Set());
  const [likesDirty, setLikesDirty] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  // 중앙 하트가 우측 하단 하트 버튼으로 날아가는 이동량 (트리거 시점에 실측)
  const [flyOffset, setFlyOffset] = useState({ x: 0, y: 0 });
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const heartBtnRef = useRef<HTMLButtonElement>(null);

  // 컨텍스트의 평가 데이터가 (비동기 로드 등으로) 갱신되면 아직 조작 전인 경우에만 동기화
  useEffect(() => {
    if (likesDirty) return;
    const ex = findMyEvaluation(evaluations, product.styleCode, currentUser);
    setLikedUrls(new Set(Array.isArray(ex?.Liked_images) ? ex.Liked_images : []));
  }, [evaluations, product.styleCode, currentUser, likesDirty]);

  // 저장 시점에 최신 evaluations를 참조하기 위한 ref (디바운스 클로저의 stale 상태 방지)
  const evaluationsRef = useRef(evaluations);
  evaluationsRef.current = evaluations;

  const likeTimer = useRef<number>();
  const persistLikes = (urls: Set<string>) => {
    window.clearTimeout(likeTimer.current);
    likeTimer.current = window.setTimeout(async () => {
      if (!currentUser) return;
      const payload = {
        Style_no: normalizeStyleNo(product.styleCode),
        Evaluator_ID: currentUser,
        Project_name: product.projectId,
        Liked_images: Array.from(urls),
      };
      try {
        await saveEvaluationMerge(currentUser, product.styleCode, payload);
        updateEvaluation(mergeWithLocalEvaluation(evaluationsRef.current, currentUser, product.styleCode, payload));
      } catch {
        toast.error("좋아요 저장 중 오류가 발생했습니다.");
      }
    }, 500);
  };

  const setLike = (src: string, liked: boolean) => {
    setLikedUrls((prev) => {
      const next = new Set(prev);
      if (liked) next.add(src);
      else next.delete(src);
      persistLikes(next);
      return next;
    });
    setLikesDirty(true);
  };

  const triggerHeartPop = () => {
    // 팝 하트(이미지 영역 중앙) → 하트 버튼 중심까지의 이동량 계산
    const area = imageAreaRef.current?.getBoundingClientRect();
    const btn = heartBtnRef.current?.getBoundingClientRect();
    if (area && btn) {
      const stripH = showStrip ? 60 : 0; // 썸네일 스트립 높이(3.75rem)만큼 이미지 중앙 보정
      setFlyOffset({
        x: btn.left + btn.width / 2 - (area.left + area.width / 2),
        y: btn.top + btn.height / 2 - (area.top + (area.height - stripH) / 2),
      });
    } else {
      setFlyOffset({ x: 0, y: 0 });
    }
    setShowHeartPop(true);
    window.setTimeout(() => setShowHeartPop(false), 1050);
  };

  const toggleCurrentLike = () => {
    if (!currentUrl) return;
    const liking = !likedUrls.has(currentUrl);
    setLike(currentUrl, liking);
    if (liking) triggerHeartPop(); // 좋아요 등록 시에만 중앙 하트 팝 (해제 시에는 없음)
  };

  // 더블탭 = 현재 이미지 좋아요(항상 on) + 하트 팝. 싱글탭 동작 없음 (핀치줌으로 확대)
  const lastTap = useRef(0);
  const handleImageClick = (src: string) => {
    const now = performance.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (!likedUrls.has(src)) setLike(src, true);
      triggerHeartPop();
    } else {
      lastTap.current = now;
    }
  };

  const evaluated = isEvaluated(evaluations, product.styleCode, currentUser);
  const isLiked = !!currentUrl && likedUrls.has(currentUrl);

  // 입력줄 표시: 평가 전이면 placeholder, 평가 후면 내 평가 요약 (DonePanel과 동일 규칙)
  const myEval = findMyEvaluation(evaluations, product.styleCode, currentUser);
  const evalSummary = (() => {
    if (!myEval) return null;
    const parts: string[] = [];
    if (myEval.Price) parts.push(`가격 ${myEval.Price}`);
    if (userRole === "STAFF_2" && myEval.Purchase_intent) parts.push(`구매의사 ${myEval.Purchase_intent}`);
    if (userRole === "STORE" && myEval.Order_count) parts.push(`예상판매 ${myEval.Order_count}`);
    if (myEval.Comment) parts.push("총평 ✓");
    // 입력 없이 열람만 한 경우도 완료로 표시
    return parts.length > 0 ? parts.join(" · ") : "확인 완료";
  })();
  const entryLabel = userRole === "STAFF_1" ? "상품정보 보기 · 총평 작성하기" : "상품정보 보기 · 평가 작성하기";

  // 캡션(상품설명) 더보기
  const desc: string = product.desc ?? "";
  const [descExpanded, setDescExpanded] = useState(false);
  const needsMore = desc.length > 50;

  return (
    <article ref={postRef} className="border-b border-muted pb-4" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 700px" }}>
      {/* 헤더행: 순번 원(인스타 프로필 사진 자리) + 품번 */}
      <div className="flex items-center gap-2.5 px-3.5 py-2">
        <div
          className={`flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full border border-black/10 bg-muted px-1.5 font-semibold text-foreground/80 tabular-nums ${
            badgeLabel.length >= 3 ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {badgeLabel}
        </div>
        <span className="text-sm font-semibold tracking-tight">{product.styleCode}</span>
      </div>

      {/* 이미지 캐러셀 + 하트 버튼 + 좋아요 하트 팝 */}
      <div className="relative" ref={imageAreaRef}>
        <FeedImageCarousel
          images={images}
          styleCode={product.styleCode}
          mountAll={nearViewport}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          onImageClick={handleImageClick}
          showThumbStrip={showStrip}
          likedUrls={likedUrls}
        />
        {/* 하트 버튼: 모든 이미지에서 우측 하단 노출. 존재감 모션(heart-in)은 포스트 최초 진입 시 1회만 */}
        {currentUrl && (
          <button
            ref={heartBtnRef}
            onClick={toggleCurrentLike}
            aria-label="이미지 좋아요"
            className={`absolute right-2.5 flex h-9 w-9 animate-heart-in items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${
              showStrip ? "bottom-[4.375rem]" : "bottom-2.5"
            }`}
          >
            <Heart
              className={`h-5 w-5 transition-transform active:scale-90 ${isLiked ? "fill-red-500 text-red-500" : "text-foreground"}`}
              strokeWidth={1.5}
            />
          </button>
        )}
        {showHeartPop && (
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center ${
              showStrip ? "bottom-[3.75rem]" : "bottom-0"
            }`}
          >
            <Heart
              className="h-24 w-24 animate-heart-pop fill-red-500 text-red-500 drop-shadow-lg"
              style={{ "--fly-x": `${flyOffset.x}px`, "--fly-y": `${flyOffset.y}px` } as React.CSSProperties}
            />
          </div>
        )}
      </div>

      {/* 캡션: 상품설명만 독립 문단으로 (품번은 헤더가 담당 — 중복 제거) */}
      {desc && (
        <div className="px-3.5 pt-3 text-sm leading-relaxed break-keep">
          {descExpanded || !needsMore ? (
            <div>
              {splitSentences(desc).map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          ) : (
            <p className="line-clamp-2">{desc}</p>
          )}
          {needsMore && !descExpanded && (
            <button onClick={() => setDescExpanded(true)} className="text-muted-foreground text-sm">
              더 보기
            </button>
          )}
        </div>
      )}

      {/* 상품정보+평가 통합 진입줄: 시트에 든 내용(정보·평가·총평)을 겉에서 알 수 있게 표기. 평가 후에는 내 평가 요약으로 바뀜 */}
      <button
        onClick={() => onOpenSheet(product)}
        className="mx-3.5 mt-2.5 flex w-[calc(100%-1.75rem)] items-center gap-2 rounded-full bg-muted/60 px-4 py-2.5 text-left"
      >
        {evalSummary ? (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{evalSummary}</span>
            <span className="shrink-0 text-xs font-medium text-[hsl(var(--eval-blue))]">수정</span>
          </>
        ) : (
          <>
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="flex-1 text-sm text-muted-foreground">{entryLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.8} />
          </>
        )}
      </button>
    </article>
  );
};

export default FeedPost;
