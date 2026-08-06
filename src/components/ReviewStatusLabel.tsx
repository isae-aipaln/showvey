import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/evaluationSave";

/**
 * 갤러리 카드 오버레이(좌측 순번 · 우측 상태)의 공통 표기 규칙.
 * PC 갤러리와 모바일 홈이 같은 모듈을 쓰게 해서 두 화면이 갈라지지 않도록 한다.
 *
 * 기본은 검정 볼드, **아직 열어보지 않은 것만 빨강**으로 남은 일을 드러낸다.
 */
export const statusTextClass = (status: ReviewStatus) =>
  status === "none" ? "text-destructive" : "text-foreground";

/** 흰 배경 상품사진 위에 글자가 얹히므로 흰 헤일로로 가독성을 확보 (지도앱 방식) */
export const CARD_LABEL_HALO = {
  textShadow: "0 0 4px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.9)",
} as const;

const ReviewStatusLabel = ({
  status,
  className = "",
}: {
  status: ReviewStatus;
  className?: string;
}) => (
  <span
    className={`flex items-center font-bold leading-none ${statusTextClass(status)} ${className}`}
    style={CARD_LABEL_HALO}
  >
    {REVIEW_STATUS_LABEL[status]}
  </span>
);

export default ReviewStatusLabel;
