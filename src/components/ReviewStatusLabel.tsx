import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/evaluationSave";

/**
 * 갤러리 카드 우측 상단 진행 상태의 공통 표기 규칙.
 * PC 갤러리와 모바일 홈이 같은 모듈을 쓰게 해서 두 화면이 갈라지지 않도록 한다.
 *
 * 아직 안 본 것(검정) → 본 것(회색으로 가라앉음) → 평가 끝난 것(파랑)으로,
 * 색만 훑어도 진행 상황이 읽히게 한다.
 */
export const statusTextClass = (status: ReviewStatus) =>
  status === "none"
    ? "text-foreground"
    : status === "viewed"
      ? "text-muted-foreground"
      : "text-[hsl(var(--eval-blue))]";

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
  /* 글자 규격은 상세 화면의 단품·코디 칩과 동일 (11px / font-medium) */
  <span
    className={`flex items-center font-medium leading-none ${statusTextClass(status)} ${className}`}
    style={CARD_LABEL_HALO}
  >
    {REVIEW_STATUS_LABEL[status]}
  </span>
);

export default ReviewStatusLabel;
