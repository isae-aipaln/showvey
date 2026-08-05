import { X, Plus, ArrowLeftRight, Star } from "lucide-react";
import ResilientImage from "@/components/ResilientImage";

export type ImageCellType = "thumbnail" | "productImages" | "coordiImages";

interface ProductImageCellProps {
  images: string[];
  type: ImageCellType;
  limit: number;
  /** 드래그 중인 타일이 이 셀의 것인지 판정한 결과 (해당 인덱스, 없으면 null) */
  draggingIndex: number | null;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onReorder: (toIndex: number) => void;
  onDelete: (index: number, url: string) => void;
  onMove: (index: number) => void;
  /** 이 이미지를 썸네일로 지정 (단품·코디 셀에서만 제공) */
  onSetThumbnail: (index: number) => void;
  /** 현재 썸네일로 지정된 URL — 해당 타일에 표식 표시 */
  thumbnailUrl?: string;
  onAddClick: () => void;
  onDropFiles: (files: File[]) => void;
  /** + 버튼에 내부 타일을 드롭했는지(맨 뒤로 이동) 판정용 */
  isInternalDrag: boolean;
}

// 품평 상세 테이블의 이미지 셀.
// 셀 폭이 고정(colgroup)이므로 flex-wrap으로 줄바꿈 — 15장이어도 모든 썸네일이 한 화면에 보임
const ProductImageCell = ({
  images,
  type,
  limit,
  draggingIndex,
  onDragStart,
  onDragEnd,
  onReorder,
  onDelete,
  onMove,
  onSetThumbnail,
  thumbnailUrl,
  onAddClick,
  onDropFiles,
  isInternalDrag,
}: ProductImageCellProps) => {
  const sortable = type !== "thumbnail";
  const movable = type === "productImages" || type === "coordiImages";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {images.map((url, i) => (
        <div
          key={url + i}
          draggable={sortable}
          onDragStart={sortable ? () => onDragStart(i) : undefined}
          onDragEnd={sortable ? onDragEnd : undefined}
          onDragOver={sortable ? (e) => e.preventDefault() : undefined}
          onDrop={
            sortable
              ? (e) => {
                  e.preventDefault();
                  onReorder(i);
                }
              : undefined
          }
          className={`group relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border${
            sortable ? " cursor-grab active:cursor-grabbing" : ""
          }${draggingIndex === i ? " opacity-40 ring-2 ring-[hsl(var(--eval-blue))]" : ""}`}
          title={sortable ? "드래그해서 순서 변경" : undefined}
        >
          {/* 저장 전 새 이미지(blob:)는 재시도 쿼리를 붙이면 깨지므로 raw img 유지 */}
          {url.startsWith("http") ? (
            <ResilientImage src={url} alt="" className="object-cover pointer-events-none" />
          ) : (
            <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover pointer-events-none" />
          )}
          <button
            onClick={() => onDelete(i, url)}
            aria-label="이미지 삭제"
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive/85 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
          {/* 단품↔코디 이동 버튼 (호버 시 좌하단) — 클릭 한 번으로 재분류 */}
          {movable && (
            <button
              onClick={() => onMove(i)}
              title={type === "productImages" ? "코디이미지로 이동" : "단품이미지로 이동"}
              className="absolute bottom-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--eval-blue)/0.9)] text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <ArrowLeftRight size={10} strokeWidth={2.5} />
            </button>
          )}
          {/* 썸네일로 지정 (호버 시 좌상단) — 이미 썸네일인 이미지는 상시 표식 */}
          {movable &&
            (thumbnailUrl === url ? (
              <span
                title="현재 썸네일"
                className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground/80 text-background"
              >
                <Star size={10} strokeWidth={2.5} className="fill-current" />
              </span>
            ) : (
              <button
                onClick={() => onSetThumbnail(i)}
                title="썸네일로 지정"
                className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Star size={10} strokeWidth={2.5} />
              </button>
            ))}
        </div>
      ))}
      {images.length < limit && (
        <button
          onClick={onAddClick}
          aria-label="이미지 추가"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("bg-[hsl(var(--eval-blue)/0.08)]");
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("bg-[hsl(var(--eval-blue)/0.08)]");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("bg-[hsl(var(--eval-blue)/0.08)]");
            // 내부 이미지 드래그를 + 버튼에 놓으면 맨 뒤로 이동, 외부 파일 드롭이면 기존 업로드 동작
            if (isInternalDrag) {
              onReorder(images.length - 1);
            } else {
              onDropFiles(Array.from(e.dataTransfer.files));
            }
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
};

export default ProductImageCell;
