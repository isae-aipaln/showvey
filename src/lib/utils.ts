import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Style_no 정규화 헬퍼
 * - ASCII 영문(a-z)만 대문자로 변환
 * - ⓐ/ⓑ 같은 유니코드 원형 문자(U+24D0~U+24E9 등)는 그대로 보존
 *   (기본 toUpperCase()는 ⓐ→Ⓐ, ⓑ→Ⓑ로 바꿔버려 DB 매칭 실패)
 */
export function normalizeStyleNo(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[a-z]/g, (ch) => ch.toUpperCase()).replace(/\//g, "_");
}
