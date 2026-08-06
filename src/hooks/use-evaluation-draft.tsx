import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/context/AppContext";
import { useEnsureAuthed } from "@/hooks/use-ensure-authed";
import {
  buildEvalPayload,
  buildLikesPayload,
  buildViewedPayload,
  saveEvaluationMerge,
  mergeWithLocalEvaluation,
  findMyEvaluation,
} from "@/lib/evaluationSave";

const AUTOSAVE_MS = 700;
const LIKE_SAVE_MS = 500;

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * PC 상세 화면의 평가 입력 상태 + 저장을 한 곳에서 관리한다.
 *
 * ⚠️ 프리필은 styleCode/userId/userRole에만 반응한다. AppContext의 `evaluations`를 의존성에 넣으면
 *    자동저장 → evaluations 변경 → 프리필 재실행 → 입력 중이던 총평이 롤백되는 버그가 생긴다.
 *    (모바일 EvaluationSheet가 의존성을 좁혀둔 이유와 동일)
 */
export function useEvaluationDraft(product: any, enabled: boolean) {
  const { evaluations, userRole, userId, updateEvaluation } = useAppContext();
  const ensureAuthed = useEnsureAuthed();
  const currentUser = userId ?? "";
  const styleCode: string = product?.styleCode ?? "";
  const projectName: string = product?.projectId ?? "";

  const [price, setPriceState] = useState<string | undefined>(undefined);
  const [purchaseIntent, setPurchaseIntentState] = useState<string | undefined>(undefined);
  const [orderCount, setOrderCountState] = useState<string | undefined>(undefined);
  const [comment, setCommentState] = useState("");
  const [likedUrls, setLikedUrls] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 최신 값을 저장 시점에 읽기 위한 ref (디바운스 클로저의 stale 상태 방지)
  const evaluationsRef = useRef(evaluations);
  evaluationsRef.current = evaluations;
  const draftRef = useRef({ price, purchaseIntent, orderCount, comment });
  draftRef.current = { price, purchaseIntent, orderCount, comment };

  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<number>();
  const likeTimer = useRef<number>();

  // ── 프리필 + 열람 마킹 ──────────────────────────────────────
  useEffect(() => {
    if (!enabled || !styleCode || !currentUser) return;
    const ex = findMyEvaluation(evaluationsRef.current, styleCode, currentUser);
    setPriceState(ex?.Price ?? undefined);
    setCommentState(ex?.Comment ?? "");
    setPurchaseIntentState(userRole === "STAFF_2" ? ex?.Purchase_intent ?? undefined : undefined);
    setOrderCountState(userRole === "STORE" ? ex?.Order_count ?? undefined : undefined);
    setLikedUrls(new Set(Array.isArray(ex?.Liked_images) ? ex.Liked_images : []));
    dirtyRef.current = false;
    setSaveState("idle");

    // 열어보기만 해도 확인 완료로 집계 (모바일과 동일 규칙)
    if (!ex) {
      const payload = buildViewedPayload(currentUser, styleCode, projectName);
      saveEvaluationMerge(currentUser, styleCode, payload)
        .then(() => updateEvaluation(mergeWithLocalEvaluation(evaluationsRef.current, currentUser, styleCode, payload)))
        .catch(() => {/* 열람 기록 실패는 조용히 무시 — 평가 저장에는 영향 없음 */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, styleCode, currentUser, userRole]);

  // ── 평가 폼 저장 ────────────────────────────────────────────
  const persist = useCallback(async (): Promise<boolean> => {
    if (!styleCode || !dirtyRef.current) return true;
    const { hasInput, payload } = buildEvalPayload(userRole, {
      styleCode,
      userId: currentUser,
      projectName,
      ...draftRef.current,
    });
    if (!hasInput) return true;
    if (!ensureAuthed()) return false;
    setSaveState("saving");
    try {
      await saveEvaluationMerge(currentUser, styleCode, payload);
      updateEvaluation(mergeWithLocalEvaluation(evaluationsRef.current, currentUser, styleCode, payload));
      dirtyRef.current = false;
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      toast.error("평가 저장 중 오류가 발생했습니다.");
      return false;
    }
  }, [styleCode, currentUser, projectName, userRole, ensureAuthed, updateEvaluation]);

  const scheduleAutosave = () => {
    dirtyRef.current = true;
    setSaveState("idle");
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => void persist(), AUTOSAVE_MS);
  };

  /** 대기 중인 자동저장을 취소하고 즉시 저장 (이동·언마운트 시) */
  const flush = useCallback(async () => {
    window.clearTimeout(autosaveTimer.current);
    return persist();
  }, [persist]);

  // 화면을 벗어날 때 미저장분 반영 — 최신 persist를 ref로 잡아 언마운트 시 1회 실행
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    return () => {
      window.clearTimeout(autosaveTimer.current);
      window.clearTimeout(likeTimer.current);
      void flushRef.current();
    };
  }, [styleCode]);

  // ── 좋아요: 평가 폼과 별도 경로로 즉시 저장 ──────────────────
  const persistLikes = (urls: Set<string>) => {
    window.clearTimeout(likeTimer.current);
    likeTimer.current = window.setTimeout(async () => {
      if (!currentUser || !styleCode) return;
      const payload = buildLikesPayload(currentUser, styleCode, projectName, urls);
      try {
        await saveEvaluationMerge(currentUser, styleCode, payload);
        updateEvaluation(mergeWithLocalEvaluation(evaluationsRef.current, currentUser, styleCode, payload));
      } catch {
        toast.error("좋아요 저장 중 오류가 발생했습니다.");
      }
    }, LIKE_SAVE_MS);
  };

  /**
   * 반환값: 이번 조작으로 좋아요가 켜졌는지 (하트 팝 애니메이션 트리거용)
   *
   * ⚠️ 판정은 updater 밖에서 한다. setState updater는 렌더 시점에 실행되므로
   *    그 안에서 값을 세팅해 반환하면 호출 시점에는 언제나 false다.
   */
  const toggleLike = (url: string): boolean => {
    if (!url) return false;
    const liked = !likedUrls.has(url);
    setLikedUrls((prev) => {
      const next = new Set(prev);
      if (liked) next.add(url);
      else next.delete(url);
      persistLikes(next);
      return next;
    });
    return liked;
  };

  return {
    price,
    setPrice: (v: string) => { setPriceState(v); scheduleAutosave(); },
    purchaseIntent,
    setPurchaseIntent: (v: string) => { setPurchaseIntentState(v); scheduleAutosave(); },
    orderCount,
    setOrderCount: (v: string) => { setOrderCountState(v); scheduleAutosave(); },
    comment,
    setComment: (v: string) => { setCommentState(v); scheduleAutosave(); },
    likedUrls,
    toggleLike,
    saveState,
    flush,
  };
}
