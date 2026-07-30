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

  const coordiSet = new Set<string>(product.coordiImages ?? []);
  // 피드 슬라이드 = 단품 + 코디만. 썸네일 필드는 갤러리 그리드 전용 —
  // 썸네일 컷은 단품 1번에도 중복 등록되므로 여기서 제외해야 같은 사진이 두 번 보이지 않음 (내용 비교 없이 구조적으로 중복 차단)
  let images: string[] = Array.from(
    new Set([...(product.productImages ?? []), ...(product.coordiImages ?? [])].filter(Boolean)),
  );
  // 단품·코디가 하나도 없는 상품만 썸네일로 대체
  if (images.length === 0 && product.thumbnailImage) images = [product.thumbnailImage];

  const [activeIndex, setActiveIndex] = useState(0);
  const currentUrl = images[Math.min(activeIndex, Math.max(images.length - 1, 0))];
  const currentIsCoordi = !!currentUrl && coordiSet.has(currentUrl);

  // 좋아요: 코디이미지 URL 단위 (evaluations.Liked_images) — 하트 즉시 저장(디바운스)
  const [likedUrls, setLikedUrls] = useState<Set<string>>(new Set());
  const [likesDirty, setLikesDirty] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);

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

  const toggleCurrentLike = () => {
    if (!currentUrl || !currentIsCoordi) return;
    setLike(currentUrl, !likedUrls.has(currentUrl));
  };

  // 더블탭 = 코디 슬라이드에서만 좋아요(항상 on) + 하트 팝. 싱글탭 동작 없음 (핀치줌으로 확대)
  const lastTap = useRef(0);
  const handleImageClick = (src: string) => {
    const now = performance.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (!coordiSet.has(src)) return;
      if (!likedUrls.has(src)) setLike(src, true);
      setShowHeartPop(true);
      window.setTimeout(() => setShowHeartPop(false), 900);
    } else {
      lastTap.current = now;
    }
  };

  const evaluated = isEvaluated(evaluations, product.styleCode, currentUser);
  const badgeLabel = product.displayNo ? String(product.displayNo) : String(sequenceNumber);
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
    return parts.length > 0 ? parts.join(" · ") : null;
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

      {/* 이미지 캐러셀 + 코디 슬라이드 전용 하트 + 더블탭 하트 팝 */}
      <div className="relative">
        <FeedImageCarousel
          images={images}
          styleCode={product.styleCode}
          mountAll={nearViewport}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          onImageClick={handleImageClick}
        />
        {/* 하트 버튼: 코디이미지 슬라이드에서만 우측 하단 노출 — 슬라이드 진입 시 팝 등장 모션으로 존재감 표시 */}
        {currentIsCoordi && (
          <button
            onClick={toggleCurrentLike}
            aria-label="코디 이미지 좋아요"
            className="absolute bottom-2.5 right-2.5 flex h-9 w-9 animate-heart-in items-center justify-center rounded-full border border-black/5 bg-white/75 backdrop-blur-sm"
          >
            <Heart
              className={`h-5 w-5 transition-transform active:scale-90 ${isLiked ? "fill-red-500 text-red-500" : "text-foreground"}`}
              strokeWidth={1.5}
            />
          </button>
        )}
        {showHeartPop && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Heart className="h-24 w-24 animate-heart-pop fill-white text-white drop-shadow-lg" />
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
