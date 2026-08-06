// PC(lg) 품평자 화면 공통 레이아웃 상수.
// ⚠️ 신규 코드는 반드시 `lg:`만 사용한다 — 커스텀 lg variant가 force-mobile 토글을 감지하므로
//    xl:/2xl:을 쓰면 '모바일 화면 보기'에서 PC 스타일이 남는다.

/** 초광폭 모니터에서 콘텐츠가 과대해지지 않도록 중앙 정렬 + 최대폭 */
export const PC_CONTAINER = "lg:mx-auto lg:w-full lg:max-w-[1920px]";

/**
 * 헤어라인 패널 (관리자 화면 CARD와 동일 톤).
 *
 * ⚠️ ring이 아니라 border를 쓴다. ring은 박스 '바깥'에 그려지는 box-shadow라,
 *    패널이 스크롤 컨테이너(overflow-y-auto) 경계에 닿으면 테두리가 잘려 보인다.
 * ⚠️ lg: 스코프 — 모바일 레이아웃에는 영향을 주지 않는다.
 */
export const PC_PANEL =
  "lg:rounded-[10px] lg:bg-card lg:border lg:border-black/[0.08] lg:shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
