import * as React from "react";

// Tailwind lg 브레이크포인트(1024px)와 반드시 동일해야 함 — 어긋나면 페이지당 개수와 그리드 열 수가 불일치
const DESKTOP_QUERY = "(min-width: 1024px)";

// PC에서 "모바일 화면 보기"를 켰는지 저장하는 키. html.force-mobile 클래스와 항상 동기화됨
// (tailwind.config.ts의 lg variant가 html:not(.force-mobile) 조건을 포함하므로 클래스만 토글하면 전체 lg: 스타일이 꺼짐)
const FORCE_MOBILE_KEY = "forceMobileView";
const FORCE_MOBILE_EVENT = "force-mobile-change";

// 앱 로드 시 저장된 설정을 html 클래스에 복원 (모듈 최초 로드 시 1회 실행)
if (typeof document !== "undefined" && localStorage.getItem(FORCE_MOBILE_KEY) === "1") {
  document.documentElement.classList.add("force-mobile");
}

export function getForceMobile() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("force-mobile");
}

export function setForceMobile(on: boolean) {
  localStorage.setItem(FORCE_MOBILE_KEY, on ? "1" : "0");
  document.documentElement.classList.toggle("force-mobile", on);
  window.dispatchEvent(new Event(FORCE_MOBILE_EVENT));
}

// 실제 화면 폭 기준 (전환 설정과 무관) — PC↔모바일 전환 버튼 노출 여부 등에 사용
export function useIsDesktopViewport() {
  // lazy initializer로 동기 초기화 — PC 첫 렌더에서 모바일 레이아웃이 잠깐 보이는 플래시 방지
  const [isDesktop, setIsDesktop] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

// 화면 폭이 PC이면서 "모바일 화면 보기"가 꺼져 있을 때만 true — 레이아웃 로직(페이지당 개수 등)에 사용
export function useIsDesktop() {
  const isDesktopViewport = useIsDesktopViewport();
  const [forceMobile, setForceMobileState] = React.useState(getForceMobile);

  React.useEffect(() => {
    const onChange = () => setForceMobileState(getForceMobile());
    window.addEventListener(FORCE_MOBILE_EVENT, onChange);
    return () => window.removeEventListener(FORCE_MOBILE_EVENT, onChange);
  }, []);

  return isDesktopViewport && !forceMobile;
}
