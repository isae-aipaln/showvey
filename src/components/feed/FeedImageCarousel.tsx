import { useEffect, useRef } from "react";
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
}

// 인스타 포스트 이미지 캐러셀 — snap-x 스와이프 + 두 손가락 핀치줌(놓으면 원복)
const FeedImageCarousel = ({
  images,
  styleCode,
  mountAll,
  activeIndex,
  onActiveChange,
  onImageClick,
}: FeedImageCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
            />
          </div>
        ))}
        {/* 아직 마운트 전인 슬라이드 자리 표시 (스크롤 폭 유지) */}
        {!mountAll &&
          images.slice(1).map((_, i) => <div key={`ph-${i}`} className="w-full h-full shrink-0 snap-center bg-white" />)}
      </div>
      {/* 이미지 순번 칩 (우상단, 흰 유리 재질) */}
      {images.length > 1 && (
        <div className="absolute right-3 top-3 rounded-full border border-black/5 bg-white/75 px-2 py-0.5 text-[11px] font-medium text-foreground/80 backdrop-blur-sm tabular-nums">
          {Math.min(activeIndex, images.length - 1) + 1} / {images.length}
        </div>
      )}
      {/* 도트 인디케이터 (iOS 페이지 컨트롤) */}
      {images.length > 1 && (
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
  );
};

export default FeedImageCarousel;
