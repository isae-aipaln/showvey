import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

/**
 * 이미지 확대 보기 팝업 (상품정보/코디평가 페이지 공용)
 * - 화면 중앙에 이미지 표시, 배경은 반투명 검정 처리
 * - 우측 상단 X 버튼 / ESC 키 / 배경 클릭으로 닫기
 * - 확대: 마우스 휠, 더블클릭(1배<->2배), 모바일 핀치 줌 (1~5배)
 * - 확대 상태에서 드래그(마우스/터치)로 이미지 이동
 */
const ImageLightbox = ({ src, onClose }: ImageLightboxProps) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  // ESC로 닫기 + 뒤 페이지 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const clampScale = (s: number) => Math.min(5, Math.max(1, s));

  const applyScale = (next: number) => {
    const clamped = clampScale(next);
    setScale(clamped);
    if (clamped === 1) setPos({ x: 0, y: 0 }); // 원래 크기로 돌아오면 위치도 초기화
  };

  const handleWheel = (e: React.WheelEvent) => {
    applyScale(scale + (e.deltaY < 0 ? 0.25 : -0.25));
  };

  const handleDoubleClick = () => {
    applyScale(scale > 1 ? 1 : 2);
  };

  // --- 마우스 드래그 이동 (확대 상태에서만) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    });
  };
  const endMouseDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // --- 터치: 한 손가락 드래그 이동 + 두 손가락 핀치 줌 ---
  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches), scale };
      dragRef.current = null;
    } else if (e.touches.length === 1 && scale > 1) {
      dragRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        origX: pos.x,
        origY: pos.y,
      };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const ratio = touchDist(e.touches) / pinchRef.current.dist;
      applyScale(pinchRef.current.scale * ratio);
    } else if (e.touches.length === 1 && dragRef.current) {
      setPos({
        x: dragRef.current.origX + (e.touches[0].clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.touches[0].clientY - dragRef.current.startY),
      });
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
      onClick={onClose}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={endMouseDrag}
      onMouseLeave={endMouseDrag}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 닫기 버튼 (우측 상단) — 클릭 시 원래 페이지로 복귀 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="이미지 닫기"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
      >
        <X className="h-6 w-6" />
      </button>

      <img
        src={src}
        alt="확대 이미지"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        className="max-h-[90vh] max-w-[92vw] select-none object-contain"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging ? "none" : "transform 0.15s ease-out",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          touchAction: "none",
        }}
      />
    </div>
  );
};

export default ImageLightbox;
