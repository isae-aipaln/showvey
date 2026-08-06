import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import ResilientImage from "@/components/ResilientImage";
import ImageThumbStrip from "@/components/ImageThumbStrip";

interface ImagePaneProps {
  images: string[];
  /** 페인 종류 표시 ("단품" / "코디") */
  label: string;
  activeIndex: number;
  onIndexChange: (i: number) => void;
  likedUrls: Set<string>;
  /** 좋아요가 '켜졌을' 때 true를 반환 → 중앙 하트 팝 재생 */
  onToggleLike: (url: string) => boolean;
  onOpenLightbox: (url: string) => void;
  /** 키보드 ←/→ 대상 페인인지. 클릭하면 이 페인으로 옮겨간다 */
  isActive: boolean;
  onActivate: () => void;
  /** 스타일이 바뀌면 하트 존재감 모션을 다시 재생하기 위한 키 */
  styleCode: string;
  /**
   * 프레임 폭(px). 부모가 두 페인의 비율과 남은 가로 폭을 함께 보고 계산해서 내려준다 —
   * 페인이 각자 높이만 보고 폭을 정하면 역할별 패널 폭 차이를 반영하지 못해 화면을 넘친다.
   */
  frameWidth?: number;
  /** 프레임 높이(px). 부모가 배치 모드(가로 3단 / 세로 스택)에 맞춰 계산해 내려준다 */
  frameHeight?: number;
  /** 썸네일 스트립을 그릴지 (두 페인이 공유해 프레임 아랫변을 맞춘다) */
  reserveStrip: boolean;
}

/**
 * PC 상세의 이미지 페인. Lightroom Compare 뷰처럼 단품·코디를 각각 독립된 페인으로 두고,
 * 페인마다 자체 캐러셀·화살표·좋아요·썸네일 스트립을 갖는다.
 * (모바일은 단품+코디를 합친 단일 슬라이더를 그대로 쓰므로 이 컴포넌트를 쓰지 않는다)
 */
const ImagePane = ({
  images,
  label,
  activeIndex,
  onIndexChange,
  likedUrls,
  onToggleLike,
  onOpenLightbox,
  isActive,
  onActivate,
  styleCode,
  frameWidth,
  frameHeight,
  reserveStrip,
}: ImagePaneProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const heartBtnRef = useRef<HTMLButtonElement>(null);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [flyOffset, setFlyOffset] = useState({ x: 0, y: 0 });

  const index = Math.min(Math.max(activeIndex, 0), Math.max(images.length - 1, 0));
  const currentUrl = images[index];

  // 부모가 인덱스를 바꾸면(키보드·썸네일) 실제 스크롤 위치를 맞춘다
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: "smooth" });
  }, [index]);

  const triggerHeartPop = () => {
    const area = frameRef.current?.getBoundingClientRect();
    const btn = heartBtnRef.current?.getBoundingClientRect();
    setFlyOffset(
      area && btn
        ? {
            x: btn.left + btn.width / 2 - (area.left + area.width / 2),
            y: btn.top + btn.height / 2 - (area.top + area.height / 2),
          }
        : { x: 0, y: 0 },
    );
    setShowHeartPop(true);
    window.setTimeout(() => setShowHeartPop(false), 1050);
  };

  if (images.length === 0) return null;

  return (
    /* 폭은 부모가 계산해 내려준다 (열을 반씩 나누지 않는다 → 좌우 레터박스 0) */
    <div style={{ width: frameWidth }} className="flex shrink-0 flex-col" onMouseDown={onActivate}>
      <div
        ref={frameRef}
        style={{ height: frameHeight }}
        className={`relative w-full shrink-0 overflow-hidden rounded-xl bg-white transition-shadow ${
          isActive ? "shadow-[0_6px_24px_rgba(0,0,0,0.10)]" : "shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        }`}
      >
        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) onIndexChange(i);
          }}
          className="flex h-full snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((src, i) => (
            <div key={src} className="relative h-full w-full shrink-0 snap-center overflow-hidden bg-white">
              {/* 현재±1만 실제 로드 (이미지가 많은 스타일에서 동시 다운로드 방지) */}
              {Math.abs(i - index) <= 1 ? (
                <ResilientImage
                  src={src}
                  alt={`${styleCode} ${label} ${i + 1}`}
                  className="object-contain cursor-zoom-in"
                  edgeFill
                  onClick={() => onOpenLightbox(src)}
                />
              ) : (
                <div className="h-full w-full bg-white" />
              )}
            </div>
          ))}
        </div>

        {/* 페인 종류 — 어느 쪽이 단품이고 코디인지 한눈에 */}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          {label}
        </span>

        {showHeartPop && (
          <span
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            style={{ ["--fly-x" as any]: `${flyOffset.x}px`, ["--fly-y" as any]: `${flyOffset.y}px` }}
          >
            <Heart className="h-24 w-24 animate-heart-pop fill-red-500 text-red-500 drop-shadow-lg" />
          </span>
        )}

        <button
          key={`${styleCode}-${label}`}
          ref={heartBtnRef}
          onClick={() => {
            if (currentUrl && onToggleLike(currentUrl)) triggerHeartPop();
          }}
          aria-label={`${label} 이미지 좋아요`}
          aria-pressed={!!currentUrl && likedUrls.has(currentUrl)}
          className="absolute bottom-3 right-3 flex h-10 w-10 animate-heart-in items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        >
          <Heart
            className={`h-5 w-5 transition-transform active:scale-90 ${
              currentUrl && likedUrls.has(currentUrl) ? "fill-red-500 text-red-500" : "text-foreground"
            }`}
            strokeWidth={1.5}
          />
        </button>

        {images.length > 1 && (
          <>
            <button
              onClick={() => onIndexChange(index - 1)}
              disabled={index <= 0}
              aria-label={`${label} 이전 이미지`}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow-md backdrop-blur-sm transition-opacity hover:bg-white disabled:opacity-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => onIndexChange(index + 1)}
              disabled={index >= images.length - 1}
              aria-label={`${label} 다음 이미지`}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow-md backdrop-blur-sm transition-opacity hover:bg-white disabled:opacity-0"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {reserveStrip && (
        <div className="h-[68px] w-full shrink-0 pt-3">
          <ImageThumbStrip images={images} activeIndex={index} onSelect={onIndexChange} likedUrls={likedUrls} />
        </div>
      )}
    </div>
  );
};

export default ImagePane;
