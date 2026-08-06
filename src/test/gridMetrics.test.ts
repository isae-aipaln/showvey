import { describe, it, expect } from "vitest";
import { computeGridMetrics } from "@/hooks/use-grid-metrics";

// 컨테이너 실측 폭(패딩 제외) 기준. 세로는 스크롤이라 높이는 보지 않는다.
// 규칙: 목표 칸 크기(208px)에 가장 가까운 열 수를 골라 남는 폭 없이 정확히 나눠 갖는다.

// 1920 화면 + 사이드바 펼침(224) + 그리드 패딩(32) → 내부 1664
const W_1920_SIDEBAR = 1664;

describe("computeGridMetrics", () => {
  it("기본값: 1920 화면 + 사이드바 펼침에서 8열", () => {
    expect(computeGridMetrics(W_1920_SIDEBAR).cols).toBe(8);
  });

  it("사이드바를 접어도 8열이 유지되고 카드만 커진다", () => {
    const expanded = computeGridMetrics(W_1920_SIDEBAR); // 사이드바 펼침
    const collapsed = computeGridMetrics(1824); // 사이드바 접힘(64px)
    expect(expanded.cols).toBe(8);
    expect(collapsed.cols).toBe(8);
    expect(collapsed.cell).toBeGreaterThan(expanded.cell);
  });

  it("남는 폭을 버리지 않는다 (한 칸도 더 못 넣을 만큼만 남음)", () => {
    const m = computeGridMetrics(W_1920_SIDEBAR);
    const used = m.cell * m.cols + 12 * (m.cols - 1);
    expect(W_1920_SIDEBAR - used).toBeLessThan(m.cell);
  });

  it("창이 넓어지면 열이 늘고, 좁아지면 준다", () => {
    expect(computeGridMetrics(1100).cols).toBeLessThan(computeGridMetrics(W_1920_SIDEBAR).cols);
    expect(computeGridMetrics(2300).cols).toBeGreaterThan(computeGridMetrics(W_1920_SIDEBAR).cols);
  });

  it("모든 폭에서 칸은 150~220, 가로로 넘치지 않는다", () => {
    for (const w of [1024, 1100, 1280, 1366, 1440, 1664, 1824, 1888, 2300, 2560]) {
      const m = computeGridMetrics(w);
      expect(m.cell).toBeGreaterThanOrEqual(150);
      expect(m.cell).toBeLessThanOrEqual(220);
      expect(m.cols).toBeGreaterThanOrEqual(3);
      expect(m.cell * m.cols + 12 * (m.cols - 1)).toBeLessThanOrEqual(w + 1);
    }
  });

  it("측정 전(0)에는 기본값 8열", () => {
    expect(computeGridMetrics(0)).toEqual({ cols: 8, cell: 208 });
  });
});
