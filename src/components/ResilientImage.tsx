import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

interface ResilientImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** 스마트 채움: 칸 비율(2:3) 대비 잘림이 20% 이하인 이미지만 cover로 꽉 채우고, 많이 잘릴 이미지는 contain 유지 */
  smartFill?: boolean;
  /** 여백 채움만: 크롭 없이 contain 유지하되, 여백을 사진 가장자리 배경색으로 채움 (피드 캐러셀용) */
  edgeFill?: boolean;
}

const CELL_RATIO = 2 / 3; // 갤러리 칸 비율 (가로/세로)
const MAX_CROP = 0.2; // 허용 잘림 비율

// 이미지 배경색 추출 — 여백을 사진 배경이 이어진 것처럼 채우기 위함.
// 네 모서리 픽셀 중 "서로 색이 가장 비슷한 두 모서리"의 평균을 사용:
// 옷·인쇄된 순번이 닿은 모서리는 색이 튀므로 자동으로 걸러지고 순수 배경만 남음.
// CORS 미허용 등으로 캔버스를 읽을 수 없으면 null (여백은 기본 흰색 유지)
const sampleEdgeColor = (img: HTMLImageElement): string | null => {
  try {
    const S = 16;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    // 테두리 픽셀을 색 구간(32단위)으로 묶어 최빈 구간을 찾고, 그 구간에 속한 픽셀들의 평균을 반환.
    // 배경이 테두리의 대부분을 차지하므로 옷·인쇄 순번이 일부 걸쳐도 배경색이 이김
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (x === 0 || y === 0 || x === S - 1 || y === S - 1) {
          const i = (y * S + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
          bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++;
          buckets.set(key, bucket);
        }
      }
    }
    let top: { r: number; g: number; b: number; n: number } | null = null;
    for (const bucket of buckets.values()) {
      if (!top || bucket.n > top.n) top = bucket;
    }
    if (!top) return null;
    return `rgb(${Math.round(top.r / top.n)}, ${Math.round(top.g / top.n)}, ${Math.round(top.b / top.n)})`;
  } catch {
    return null;
  }
};

// 느린 네트워크 대비 이미지 로더 (모바일 피드/그리드 전용):
// - 로딩 중: 회색 스켈레톤 표시 (빈 화면과 구분)
// - 로드 실패: 2초 → 5초 간격으로 자동 재시도 (캐시버스터로 강제 재요청)
// - 자동 재시도 소진: "탭하여 다시 불러오기" 표시
const RETRY_DELAYS = [2000, 5000];

const ResilientImage = ({ src, alt, className, onClick, smartFill, edgeFill }: ResilientImageProps) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [smartFit, setSmartFit] = useState<"contain" | "cover">("contain");
  const [edgeColor, setEdgeColor] = useState<string | null>(null);
  const timer = useRef<number>();

  // src가 바뀌면(캐러셀 재사용 등) 상태 리셋
  useEffect(() => {
    setStatus("loading");
    setAttempt(0);
  }, [src]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // 재시도 시 브라우저의 실패 캐시를 우회하기 위한 쿼리 파라미터 (Storage는 여분 파라미터 무시)
  const effectiveSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  const handleError = () => {
    if (attempt < RETRY_DELAYS.length) {
      timer.current = window.setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAYS[attempt]);
    } else {
      setStatus("failed");
    }
  };

  if (status === "failed") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setAttempt((a) => a + 1);
          setStatus("loading");
        }}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/50 text-muted-foreground"
      >
        <RotateCcw className="h-5 w-5" />
        <span className="text-[10px]">탭하여 다시 불러오기</span>
      </button>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={edgeColor ? { backgroundColor: edgeColor } : undefined}
    >
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-muted/60" />}
      <img
        src={effectiveSrc}
        alt={alt}
        crossOrigin={smartFill || edgeFill ? "anonymous" : undefined}
        className={`relative h-full w-full ${className ?? ""}`}
        style={smartFill ? { objectFit: smartFit } : undefined}
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          setStatus("loaded");
          if (smartFill) {
            // 칸(2:3)에 cover로 채웠을 때 잘려나가는 비율 계산 — 허용치 이내면 꽉 채움
            const img = e.currentTarget;
            const r = img.naturalWidth / img.naturalHeight;
            const cropLoss = r > CELL_RATIO ? 1 - CELL_RATIO / r : 1 - r / CELL_RATIO;
            if (cropLoss <= MAX_CROP) {
              setSmartFit("cover");
            } else {
              // 크롭 불가한 비율 → contain + 여백을 사진 가장자리 배경색으로 채워 이어진 것처럼 표시
              setSmartFit("contain");
              setEdgeColor(sampleEdgeColor(img));
            }
          } else if (edgeFill) {
            // 크롭 없이 여백만 사진 배경색으로 채움 (피드: 상품이 잘리면 안 되므로 contain 고정)
            setEdgeColor(sampleEdgeColor(e.currentTarget));
          }
        }}
        onError={handleError}
        onClick={onClick}
      />
    </div>
  );
};

export default ResilientImage;
