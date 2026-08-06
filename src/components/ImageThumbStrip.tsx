import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";

interface ImageThumbStripProps {
  images: string[];
  activeIndex: number;
  onSelect: (i: number) => void;
  likedUrls?: Set<string>;
  className?: string;
}

/**
 * 사진앱식 하단 썸네일 스트립 (PC 상세용).
 * 캐러셀과 같은 URL이라 추가 다운로드가 없고, 활성 썸네일은 자동으로 가운데로 스크롤된다.
 */
const ImageThumbStrip = ({ images, activeIndex, onSelect, likedUrls, className }: ImageThumbStripProps) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const active = Math.min(Math.max(activeIndex, 0), Math.max(images.length - 1, 0));

  useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.children[active] as HTMLElement | undefined;
    if (!strip || !btn) return;
    strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  if (images.length < 2) return null;

  return (
    <div
      ref={stripRef}
      className={`flex justify-center gap-1.5 overflow-x-auto ${className ?? ""}`}
      style={{ scrollbarWidth: "none" }}
    >
      {images.map((src, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          aria-label={`${i + 1}번 이미지로 이동`}
          aria-current={i === active ? "true" : undefined}
          className={`relative h-14 w-10 shrink-0 overflow-hidden rounded transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
            i === active ? "ring-1 ring-foreground opacity-100" : "opacity-45 hover:opacity-80"
          }`}
        >
          <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          {likedUrls?.has(src) && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 drop-shadow" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default ImageThumbStrip;
