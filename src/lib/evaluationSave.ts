import { db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { normalizeStyleNo } from "@/lib/utils";

// 모바일 피드/바텀시트에서 사용하는 평가 저장 공통 모듈.
// Firestore 문서 규칙은 ProductDetailShell.persistEvaluation과 동일:
//   문서 ID = `${userId}_${normalizeStyleNo(styleCode)}`, setDoc merge

export interface EvalInput {
  styleCode: string;
  userId: string;
  projectName: string;
  price?: string;
  purchaseIntent?: string; // STAFF_2
  orderCount?: string; // STORE
  comment?: string;
}

// 역할별 저장 필드 구성 (STORE: Price+Order_count / STAFF_2: Price+Purchase_intent / 그 외: Comment만)
export const buildEvalPayload = (role: string | null, input: EvalInput) => {
  const sc = normalizeStyleNo(input.styleCode);
  const trimmedComment = (input.comment ?? "").trim();
  const base = { Style_no: sc, Evaluator_ID: input.userId, Project_name: input.projectName };

  if (role === "STORE") {
    return {
      hasInput: !!(input.price || input.orderCount || trimmedComment),
      payload: { ...base, Price: input.price ?? null, Order_count: input.orderCount ?? null, Comment: trimmedComment || null },
    };
  }
  if (role === "STAFF_2") {
    return {
      hasInput: !!(input.price || input.purchaseIntent || trimmedComment),
      payload: { ...base, Price: input.price ?? null, Purchase_intent: input.purchaseIntent ?? null, Comment: trimmedComment || null },
    };
  }
  return {
    hasInput: !!trimmedComment,
    payload: { ...base, Comment: trimmedComment },
  };
};

// 좋아요만 부분 저장할 때의 payload.
// 평가 폼(buildEvalPayload)과 경로를 분리해 서로 덮어쓰지 않게 한다 — setDoc merge라 안전
export const buildLikesPayload = (
  userId: string,
  styleCode: string,
  projectName: string,
  urls: Iterable<string>,
) => ({
  Style_no: normalizeStyleNo(styleCode),
  Evaluator_ID: userId,
  Project_name: projectName,
  Liked_images: Array.from(urls),
});

// 상품을 열어보기만 해도 "확인 완료"로 집계하기 위한 최소 문서
export const buildViewedPayload = (userId: string, styleCode: string, projectName: string) => ({
  Style_no: normalizeStyleNo(styleCode),
  Evaluator_ID: userId,
  Project_name: projectName,
});

// Firestore에 부분 저장 (merge). Liked_images 등 다른 필드는 건드리지 않음
export const saveEvaluationMerge = async (userId: string, styleCode: string, payload: Record<string, any>) => {
  const sc = normalizeStyleNo(styleCode);
  const evalRef = doc(db, "evaluations", `${userId}_${sc}`);
  await setDoc(evalRef, payload, { merge: true });
};

// AppContext.updateEvaluation은 문서를 통째로 교체하므로,
// 부분 저장 시 로컬 상태의 기존 필드가 유실되지 않도록 기존 문서와 병합한 완전한 객체를 만들어 준다
export const mergeWithLocalEvaluation = (
  evaluations: any[],
  userId: string,
  styleCode: string,
  payload: Record<string, any>,
) => {
  const sc = normalizeStyleNo(styleCode);
  const existing = evaluations.find(
    (e) => normalizeStyleNo(String(e.Style_no)) === sc && e.Evaluator_ID === userId,
  );
  return { ...(existing ?? {}), ...payload, Style_no: sc, Evaluator_ID: userId };
};

// 해당 스타일을 현재 유저가 평가했는지 (GalleryPage.checkIsEvaluated와 동일 규칙)
export const isEvaluated = (evaluations: any[], styleCode: string, userId: string) =>
  evaluations.some(
    (e) => normalizeStyleNo(String(e.Style_no)) === normalizeStyleNo(styleCode) && e.Evaluator_ID === userId,
  );

// 스타일별 진행 상태 3단계.
//   none   미조회 — 문서 자체가 없음 (상세를 연 적 없음)
//   viewed 조회 완료 — 열람 기록만 있고 입력한 내용이 없음
//   done   평가 완료 — 총평·좋아요·선택지 중 하나라도 입력함
export type ReviewStatus = "none" | "viewed" | "done";

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  none: "미조회",
  viewed: "조회 완료",
  done: "평가 완료",
};

export const getReviewStatus = (evaluations: any[], styleCode: string, userId: string): ReviewStatus => {
  const ev = findMyEvaluation(evaluations, styleCode, userId);
  if (!ev) return "none";
  const hasComment = String(ev.Comment ?? "").trim() !== "";
  const hasLikes = Array.isArray(ev.Liked_images) && ev.Liked_images.length > 0;
  const hasChoice = !!(ev.Price || ev.Purchase_intent || ev.Order_count);
  return hasComment || hasLikes || hasChoice ? "done" : "viewed";
};

// 현재 유저의 해당 스타일 평가 문서 조회 (프리필용)
export const findMyEvaluation = (evaluations: any[], styleCode: string, userId: string) =>
  evaluations.find(
    (e) => normalizeStyleNo(String(e.Style_no)) === normalizeStyleNo(styleCode) && e.Evaluator_ID === userId,
  );
