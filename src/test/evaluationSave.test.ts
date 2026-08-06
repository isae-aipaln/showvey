import { describe, it, expect, vi } from "vitest";

// Firestore 초기화를 피하기 위해 db 모듈만 목킹 (순수 함수만 검증)
vi.mock("@/firebase", () => ({ db: {} }));

import {
  buildEvalPayload,
  mergeWithLocalEvaluation,
  isEvaluated,
  findMyEvaluation,
  getReviewStatus,
} from "@/lib/evaluationSave";

// 이 테스트는 PC 저장 로직을 evaluationSave로 통합하는 리팩터링의 안전망이다.
// 여기서 고정한 payload 형태가 곧 모바일(EvaluationSheet/FeedPost)의 저장 규칙이므로,
// 아래 스냅샷이 깨지면 모바일 회귀를 의심해야 한다.

const base = { styleCode: "26xgm025", userId: "tester", projectName: "27_SP" };

describe("buildEvalPayload — 역할별 필드 구성", () => {
  it("STORE: Price + Order_count + Comment", () => {
    const { hasInput, payload } = buildEvalPayload("STORE", {
      ...base,
      price: "적정",
      orderCount: "5장이내",
      comment: "  좋아요  ",
    });
    expect(hasInput).toBe(true);
    expect(payload).toEqual({
      Style_no: "26XGM025", // normalizeStyleNo로 대문자화
      Evaluator_ID: "tester",
      Project_name: "27_SP",
      Price: "적정",
      Order_count: "5장이내",
      Comment: "좋아요", // trim 적용
    });
    expect(payload).not.toHaveProperty("Purchase_intent");
  });

  it("STAFF_2: Price + Purchase_intent + Comment", () => {
    const { hasInput, payload } = buildEvalPayload("STAFF_2", {
      ...base,
      price: "비쌈",
      purchaseIntent: "관심",
    });
    expect(hasInput).toBe(true);
    expect(payload).toEqual({
      Style_no: "26XGM025",
      Evaluator_ID: "tester",
      Project_name: "27_SP",
      Price: "비쌈",
      Purchase_intent: "관심",
      Comment: null, // 빈 총평은 null
    });
    expect(payload).not.toHaveProperty("Order_count");
  });

  it("STAFF_1(그 외): Comment만", () => {
    const { hasInput, payload } = buildEvalPayload("STAFF_1", { ...base, comment: "총평입니다" });
    expect(hasInput).toBe(true);
    expect(payload).toEqual({
      Style_no: "26XGM025",
      Evaluator_ID: "tester",
      Project_name: "27_SP",
      Comment: "총평입니다",
    });
    expect(payload).not.toHaveProperty("Price");
  });

  it("입력이 전혀 없으면 hasInput=false (빈 문서 생성 방지)", () => {
    expect(buildEvalPayload("STORE", base).hasInput).toBe(false);
    expect(buildEvalPayload("STAFF_2", base).hasInput).toBe(false);
    expect(buildEvalPayload("STAFF_1", base).hasInput).toBe(false);
  });

  it("공백만 있는 총평은 입력으로 치지 않는다", () => {
    expect(buildEvalPayload("STAFF_1", { ...base, comment: "   " }).hasInput).toBe(false);
  });

  it("STORE/STAFF_2는 총평 없이 선택지만 골라도 저장 대상", () => {
    expect(buildEvalPayload("STORE", { ...base, price: "저렴" }).hasInput).toBe(true);
    expect(buildEvalPayload("STAFF_2", { ...base, purchaseIntent: "보류" }).hasInput).toBe(true);
  });
});

describe("mergeWithLocalEvaluation — 부분 저장 시 기존 필드 보존", () => {
  it("기존 문서의 다른 필드를 유지한 채 payload를 덮어쓴다", () => {
    const evaluations = [
      {
        Style_no: "26XGM025",
        Evaluator_ID: "tester",
        Price: "저렴",
        Liked_images: ["https://a/1.jpg"],
        Comment: "이전 총평",
      },
    ];
    const merged = mergeWithLocalEvaluation(evaluations, "tester", "26xgm025", {
      Style_no: "26XGM025",
      Evaluator_ID: "tester",
      Comment: "새 총평",
    });
    // 덮어쓴 필드
    expect(merged.Comment).toBe("새 총평");
    // 보존돼야 하는 필드 (좋아요가 평가 저장으로 날아가면 안 됨)
    expect(merged.Liked_images).toEqual(["https://a/1.jpg"]);
    expect(merged.Price).toBe("저렴");
  });

  it("기존 문서가 없으면 payload만으로 구성", () => {
    const merged = mergeWithLocalEvaluation([], "tester", "26xgm025", { Comment: "첫 평가" });
    expect(merged).toEqual({ Comment: "첫 평가", Style_no: "26XGM025", Evaluator_ID: "tester" });
  });
});

describe("getReviewStatus — 미조회 / 조회 완료 / 평가 완료", () => {
  const of = (doc: any) => getReviewStatus(doc ? [doc] : [], "26xgm025", "tester");
  const base = { Style_no: "26XGM025", Evaluator_ID: "tester" };

  it("문서가 없으면 미조회", () => {
    expect(of(null)).toBe("none");
  });

  it("열람 기록만 있으면 조회 완료", () => {
    expect(of({ ...base, Project_name: "27_SP" })).toBe("viewed");
  });

  it("빈 총평·빈 좋아요 배열은 여전히 조회 완료", () => {
    expect(of({ ...base, Comment: "", Liked_images: [] })).toBe("viewed");
    expect(of({ ...base, Comment: "   ", Price: null, Purchase_intent: null })).toBe("viewed");
  });

  it("총평·좋아요·선택지 중 하나라도 있으면 평가 완료", () => {
    expect(of({ ...base, Comment: "좋아요" })).toBe("done");
    expect(of({ ...base, Liked_images: ["https://a/1.jpg"] })).toBe("done");
    expect(of({ ...base, Price: "적정" })).toBe("done");
    expect(of({ ...base, Purchase_intent: "관심" })).toBe("done");
    expect(of({ ...base, Order_count: "5장이내" })).toBe("done");
  });

  it("다른 평가자의 문서는 내 상태에 영향을 주지 않는다", () => {
    const evals = [{ Style_no: "26XGM025", Evaluator_ID: "other", Comment: "남의 평가" }];
    expect(getReviewStatus(evals, "26XGM025", "tester")).toBe("none");
  });
});

describe("isEvaluated / findMyEvaluation — 품번 정규화 매칭", () => {
  const evaluations = [
    { Style_no: "26XGM025", Evaluator_ID: "tester", Comment: "내 평가" },
    { Style_no: "26XGM025", Evaluator_ID: "other", Comment: "남의 평가" },
  ];

  it("소문자 품번으로 조회해도 매칭된다", () => {
    expect(isEvaluated(evaluations, "26xgm025", "tester")).toBe(true);
    expect(findMyEvaluation(evaluations, "26xgm025", "tester")?.Comment).toBe("내 평가");
  });

  it("다른 평가자의 문서는 잡히지 않는다", () => {
    expect(isEvaluated(evaluations, "26XGM025", "nobody")).toBe(false);
    expect(findMyEvaluation(evaluations, "26XGM025", "nobody")).toBeUndefined();
  });
});
