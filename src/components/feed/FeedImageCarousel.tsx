import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import ResilientImage from "@/components/ResilientImage";

interface FeedImageCarouselProps {
  images: string[];
  styleCode: string;
  /** 포스트가 뷰포트 근처에 들어오기 전에는 첫 이미지(썸네일)만 마운트해 네트워크 부하를 줄임 */
  mountAll: boolean;
  activeIndex: number;
  onActiveChange: (i: number) => void;
  /** 더블탭 좋아요 감지용 (싱글탭 동작 없음) */
  onImageClick: (src: string) => void;
  /** 사진앱식 하단 썸네일 스트립 (A안 스타일 전용). 캐러셀과 같은 URL 재사용이라 추가 다운로드 없음 */
  showThumbStrip?: boolean;
  /** 좋아요한 이미지 URL 집합 — 스트립 썸네일 중앙에 하트 표시 */
  likedUrls?: Set<string>;
}

// 인스타 포스트 이미지 캐러셀 — snap-x 스와이프 + 두 손가락 핀치줌(놓으면 원복)
const FeedImageCarousel = ({
  images,
  styleCode,
  mountAll,
  activeIndex,
  onActiveChange,
  onImageClick,
  showThumbStrip,
  likedUrls,
}: FeedImageCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // 썸네일 탭 → 해당 슬라이드로 이동
  const scrollToIndex = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    onActiveChange(i);
  };

  // 슬라이드 전환 시 스트립에서 현재 썸네일이 보이도록 가로 스크롤 (세로 페이지 스크롤은 건드리지 않음)
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const btn = strip.children[activeIndex] as HTMLElement | undefined;
    if (!btn) return;
    strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2, behavior: "smooth" });
  }, [activeIndex]);

  // 스타일이 바뀌면(재사용 시) 첫 이미지로 리셋
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [styleCode]);

  // 두 손가락 핀치줌: 현재 슬라이드 이미지를 프레임 안에서 확대(최대 3배), 손을 떼면 원복.
  // React 합성 터치 이벤트는 passive라 preventDefault가 안 먹혀 네이티브 리스너로 부착
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startDist = 0;
    let startMid = { x: 0, y: 0 };
    let target: HTMLElement | null = null;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const slideW = el.clientWidth;
      const idx = Math.round(el.scrollLeft / slideW);
      const img = el.children[idx]?.querySelector("img") as HTMLElement | null;
      if (!img) return;
      target = img;
      startDist = dist(e.touches);
      startMid = mid(e.touches);
      el.style.overflowX = "hidden"; // 핀치 중 가로 스와이프 잠금
      img.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!target || e.touches.length !== 2) return;
      e.preventDefault(); // 브라우저 페이지 줌 차단
      const scale = Math.min(Math.max(dist(e.touches) / startDist, 1), 3);
      const m = mid(e.touches);
      target.style.transform = `translate(${m.x - startMid.x}px, ${m.y - startMid.y}px) scale(${scale})`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!target || e.touches.length >= 2) return;
      const img = target;
      target = null;
      img.style.transition = "transform 0.25s ease-out";
      img.style.transform = "";
      window.setTimeout(() => {
        img.style.transition = "";
        if (el) el.style.overflowX = "auto";
      }, 260);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex w-full aspect-[2/3] items-center justify-center bg-white">
        <p className="text-sm font-bold text-foreground break-all px-3 text-center leading-snug">{styleCode}</p>
      </div>
    );
  }

  const visibleImages = mountAll ? images : images.slice(0, 1);

  return (
    <div>
    <div className="relative w-full aspect-[2/3] overflow-hidden bg-white">
      <div
        ref={scrollRef}
        onScroll={() => {
          if (scrollRef.current)
            onActiveChange(Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth));
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
      >
        {visibleImages.map((src, i) => (
          <div key={i} className="relative w-full h-full shrink-0 snap-center overflow-hidden bg-white">
            <ResilientImage
              src={src}
              className="object-contain"
              alt={`${styleCode}-${i}`}
              onClick={() => onImageClick(src)}
              edgeFill
            />
          </div>
        ))}
        {/* 아직 마운트 전인 슬라이드 자리 표시 (스크롤 폭 유지) */}
        {!mountAll &&
          images.slice(1).map((_, i) => <div key={`ph-${i}`} className="w-full h-full shrink-0 snap-center bg-white" />)}
      </div>
      {/* 이미지 순번 칩 (우상단) — 흰 배경 + 그림자 (흰 이미지 위에서도 구별), 하트 버튼과 우측 정렬(right-2.5) 통일 */}
      {images.length > 1 && (
        <div className="absolute right-2.5 top-2.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-foreground/80 shadow-[0_2px_8px_rgba(0,0,0,0.35)] tabular-nums">
          {Math.min(activeIndex, images.length - 1) + 1} / {images.length}
        </div>
      )}
      {/* 도트 인디케이터 (iOS 페이지 컨트롤) — 썸네일 스트립이 있으면 중복이라 숨김 */}
      {images.length > 1 && !showThumbStrip && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-[5px] w-[5px] rounded-full transition-colors ${i === activeIndex ? "bg-foreground" : "bg-foreground/20"}`}
            />
          ))}
        </div>
      )}
    </div>
    {/* 사진앱식 하단 썸네일 스트립: 뷰포트 근처에서만 이미지 마운트(과부하 방지), 캐러셀과 같은 URL이라 추가 다운로드 없음 */}
    {showThumbStrip && images.length > 1 && (
      <div ref={stripRef} className="flex gap-1 overflow-x-auto px-3 py-1.5" style={{ scrollbarWidth: "none" }}>
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => scrollToIndex(i)}
            aria-label={`${i + 1}번 이미지로 이동`}
            className={`relative h-12 w-9 shrink-0 overflow-hidden rounded transition-opacity ${
              i === Math.min(activeIndex, images.length - 1) ? "ring-1 ring-foreground opacity-100" : "opacity-45"
            }`}
          >
            {mountAll ? (
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
            {/* 좋아요한 이미지 표시: 썸네일 중앙 빨간 하트 */}
            {likedUrls?.has(src) && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 drop-shadow" />
              </span>
            )}
          </button>
        ))}
      </div>
    )}
    </div>
  );
};

export default FeedImageCarousel;
