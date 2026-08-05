// 관리자 화면 테이블 공용 클래스 — 계정관리·품평목록·품평상세의 톤을 통일

// 배경 단차(muted 위의 흰 면)로 영역을 구분하되, 헤어라인 ring으로 경계선을 또렷하게 —
// 경계가 흐리면 페이지 제목과의 정렬선이 눈에 잡히지 않음
/** 카드 컨테이너 — 모서리 10px (macOS 패널 기준. 16px 이상은 웹 SaaS 느낌이 강함) */
export const CARD = "rounded-[10px] bg-card ring-1 ring-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

/** 테이블 헤더 셀 */
export const TH = "px-6 py-3.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";

/** 테이블 본문 셀 */
export const TD = "px-6 py-3.5 align-middle text-sm";

/** 본문 행 (hover 강조) */
export const ROW = "group border-b border-border/60 transition-colors hover:bg-muted/50";

/** thead 배경 — sticky일 때 아래 행이 비치지 않도록 불투명 */
export const THEAD = "sticky top-0 z-20 border-b border-border bg-[hsl(var(--muted))]";

/** 체크박스 */
export const CHECKBOX = "h-4 w-4 rounded border-border accent-[hsl(var(--foreground))]";
