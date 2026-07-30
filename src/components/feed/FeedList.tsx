import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/use-in-view";
import FeedPost from "./FeedPost";

const BATCH_SIZE = 4;

interface FeedListProps {
  products: any[];
  /** 갤러리 그리드에서 탭한 상품 위치 — 그 상품이 첫 화면, 위로는 이전 스타일·아래로는 다음 스타일 */
  startIndex: number;
  onOpenSheet: (product: any) => void;
}

// 인스타 홈 피드: 탭한 상품부터 표시하되 양방향 점진 렌더링 —
// 아래로 스크롤하면 다음 스타일, 위로 스크롤하면 이전 스타일이 이어짐 (과부하 방지 4개 단위)
const FeedList = ({ products, startIndex, onOpenSheet }: FeedListProps) => {
  const [beforeCount, setBeforeCount] = useState(0); // startIndex 앞쪽에 렌더된 개수
  const [afterCount, setAfterCount] = useState(BATCH_SIZE); // startIndex부터 아래로 렌더된 개수
  const { ref: topRef, inView: topVisible } = useInView<HTMLDivElement>({ rootMargin: "600px" });
  const { ref: bottomRef, inView: bottomVisible } = useInView<HTMLDivElement>({ rootMargin: "800px" });

  // 아래 sentinel → 다음 배치 (100ms 지연으로 IntersectionObserver 갱신 틈 확보)
  useEffect(() => {
    if (!bottomVisible || startIndex + afterCount >= products.length) return;
    const t = window.setTimeout(
      () => setAfterCount((c) => Math.min(c + BATCH_SIZE, products.length - startIndex)),
      100,
    );
    return () => window.clearTimeout(t);
  }, [bottomVisible, afterCount, startIndex, products.length]);

  // 위 sentinel → 이전 배치를 위에 붙임. 붙이기 직전 문서 높이를 기록해 두었다가
  // 렌더 직후 늘어난 만큼 스크롤을 내려 화면이 밀리지 않게 보정 (인스타식 역방향 로딩)
  const prependHeight = useRef<number | null>(null);
  useEffect(() => {
    if (!topVisible || beforeCount >= startIndex) return;
    const t = window.setTimeout(() => {
      prependHeight.current = document.documentElement.scrollHeight;
      setBeforeCount((c) => Math.min(c + BATCH_SIZE, startIndex));
    }, 100);
    return () => window.clearTimeout(t);
  }, [topVisible, beforeCount, startIndex]);

  useLayoutEffect(() => {
    if (prependHeight.current == null) return;
    const delta = document.documentElement.scrollHeight - prependHeight.current;
    prependHeight.current = null;
    if (delta > 0) window.scrollBy(0, delta);
  }, [beforeCount]);

  const first = startIndex - beforeCount;
  const feedProducts = products.slice(first, startIndex + afterCount);

  return (
    <div>
      {beforeCount < startIndex && <div ref={topRef} className="h-1" />}
      {feedProducts.map((product, i) => (
        <FeedPost
          key={product.id}
          product={product}
          sequenceNumber={first + i + 1}
          onOpenSheet={onOpenSheet}
        />
      ))}
      {startIndex + afterCount < products.length && <div ref={bottomRef} className="h-10" />}
      {feedProducts.length > 0 && startIndex + afterCount >= products.length && (
        <p className="py-8 text-center text-xs text-muted-foreground">모든 스타일을 확인했습니다.</p>
      )}
    </div>
  );
};

export default FeedList;
