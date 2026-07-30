import { useEffect, useRef, useState } from "react";

// 요소가 뷰포트(rootMargin 확장 포함)에 들어왔는지 감지 — 피드 점진 렌더링·캐러셀 지연 마운트 공용.
// once=true면 한 번 보인 뒤에는 관찰을 멈추고 true를 유지 (이미지 마운트 해제 방지)
export function useInView<T extends HTMLElement>(options?: { rootMargin?: string; once?: boolean }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = "0px", once = false } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (once && inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, once, inView]);

  return { ref, inView };
}
