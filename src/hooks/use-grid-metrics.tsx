import { useEffect, useState } from "react";

// PC 갤러리 카드 크기 (2:3 비율 카드의 '폭' 기준)
// 목표 크기 — 1920 화면에서 사이드바를 펼치든 접든 8열이 유지되는 값
const CELL_IDEAL = 208;
const CELL_MAX = 220;
const CELL_MIN = 150;
const COLS_MIN = 3;
const COLS_MAX = 14;
const GAP_X = 12; // gap-x-3
const GAP_Y = 16; // gap-y-4

export interface GridMetrics {
  cols: number;
  cell: number; // 카드 폭(px)
}

/**
 * 컨테이너 폭으로 열 수와 칸 크기를 산출한다.
 *
 * 세로는 스크롤이므로 높이는 보지 않는다. 열 수는 목표 칸 크기(208px)에 가장 가까운 개수를
 * 반올림으로 고른 뒤 남는 폭 없이 정확히 나눠 갖는다 — 고정 칸 크기로 몇 개 들어가는지 세면(floor)
 * 나머지 폭이 통째로 버려져 열이 하나 모자라게 나온다.
 */
export function computeGridMetrics(width: number): GridMetrics {
  if (width <= 0) return { cols: 8, cell: CELL_IDEAL };

  const cellForCols = (c: number) => (width - GAP_X * (c - 1)) / c;

  let cols = Math.max(COLS_MIN, Math.min(COLS_MAX, Math.round((width + GAP_X) / (CELL_IDEAL + GAP_X))));
  while (cols > COLS_MIN && cellForCols(cols) < CELL_MIN) cols -= 1;

  const cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(cellForCols(cols))));
  return { cols, cell };
}

/** ResizeObserver로 컨테이너를 실측 → 그리드 지표. 값이 실제로 변할 때만 setState */
export function useGridMetrics(el: HTMLElement | null, enabled: boolean): GridMetrics {
  const [metrics, setMetrics] = useState<GridMetrics>(() => computeGridMetrics(0));

  useEffect(() => {
    if (!el || !enabled) return;
    const measure = () => {
      // clientWidth는 패딩을 포함하므로 내용 영역만 남긴다
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const next = computeGridMetrics(el.clientWidth - padX);
      setMetrics((prev) => (prev.cols === next.cols && prev.cell === next.cell ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, enabled]);

  return metrics;
}

export const GRID_GAP_X = GAP_X;
export const GRID_GAP_Y = GAP_Y;
