import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

interface ResilientImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

// 느린 네트워크 대비 이미지 로더 (모바일 피드/그리드 전용):
// - 로딩 중: 회색 스켈레톤 표시 (빈 화면과 구분)
// - 로드 실패: 2초 → 5초 간격으로 자동 재시도 (캐시버스터로 강제 재요청)
// - 자동 재시도 소진: "탭하여 다시 불러오기" 표시
const RETRY_DELAYS = [2000, 5000];

const ResilientImage = ({ src, alt, className, onClick }: ResilientImageProps) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
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
    <div className="relative h-full w-full">
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-muted/60" />}
      <img
        src={effectiveSrc}
        alt={alt}
        className={`relative h-full w-full ${className ?? ""}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={handleError}
        onClick={onClick}
      />
    </div>
  );
};

export default ResilientImage;
