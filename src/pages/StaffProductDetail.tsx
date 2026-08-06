import { useParams } from "react-router-dom";
import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import ProductDetailShell, { DbProduct } from "@/components/ProductDetailShell";
import { useAppContext } from "@/context/AppContext";

const fmt = (v: number | null | undefined) => (v != null ? v.toLocaleString() : "-");

// 빈 문자열도 "값 없음"으로 취급 (?? 만으로는 ""가 통과해 셀이 완전히 비어 로딩 중처럼 보임)
const val = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s === "" ? "—" : s;
};

const categoryMap: Record<string, string> = {
  A: "특종", B: "블라우스", G: "사은품", H: "코트", I: "이너", J: "자켓",
  K: "니트", L: "오픈형원피스", M: "특종", O: "원피스", P: "팬츠", Q: "가방", R: "나시",
  S: "스커트", T: "티셔츠", U: "기타", V: "조끼", W: "주얼리", X: "신발",
  Y: "잡화", Z: "스카프",
};
const getCategory = (styleNo?: string) => {
  if (!styleNo || styleNo.length < 5) return "-";
  return categoryMap[styleNo.charAt(4).toUpperCase()] ?? "-";
};

// 상품설명을 문장(마침표) 단위로 나눠 한 문장씩 줄바꿈 표시
const splitSentences = (text?: string | null): string[] =>
  (text || "").split(/(?<=[.!?])\s+|(?<=니다)\s+/).map((s) => s.trim()).filter(Boolean);

export const StaffInfoSection = ({
  drawerOpen,
  dbProduct,
  defaultDetailOpen,
  spacedSections,
}: {
  drawerOpen: boolean;
  dbProduct: DbProduct | null;
  /** 상세정보(원가) 초기 펼침 여부 — 미지정 시 기존 동작(STAFF_1은 펼침). 모바일 평가 시트는 false로 접어서 평가 입력이 먼저 보이게 */
  defaultDetailOpen?: boolean;
  /** 기본정보와 상세정보 사이를 띄울지. 상세 페이지 패널에서만 켜서 총평과의 간격(16px)과 리듬을 맞춘다
   *  (모바일 평가 시트는 기존 붙은 형태 유지) */
  spacedSections?: boolean;
}) => {
  const { userRole } = useAppContext();
  // 임직원1(STAFF_1)은 페이지 진입 시 상세정보가 자동으로 펼쳐진 상태로 시작 (접기 토글은 그대로 사용 가능)
  const [isDetailOpen, setIsDetailOpen] = useState(defaultDetailOpen ?? userRole === "STAFF_1");
  const p = dbProduct;

  return (
    /* 기본정보와 상세정보는 전 기기에서 세로로 쌓임.
       (PC가 좌우 2단이던 시절 높이를 맞추려고 넣었던 flex/h-full 체인은 우측 단일 패널로 바뀌며 불필요해져 제거) */
    <div className={`w-full mb-4${userRole !== "ADMIN" ? " lg:mb-0" : ""}`}>
      <div>
      <table className={`w-full border-collapse border border-muted-foreground/40 text-xs lg:text-[13px] text-left mb-0${
        /* PC: 라운드 모서리 적용 (border-collapse에선 radius가 안 먹어 separate로 전환하고 셀 테두리를 구분선 방식으로 변경) */
        userRole !== "ADMIN"
          ? " lg:bg-card lg:border-black/[0.06] lg:border-separate lg:border-spacing-0 lg:rounded-[10px] lg:overflow-hidden lg:[&_td]:border-0 lg:[&_td]:border-b lg:[&_td]:border-black/[0.06] lg:[&_tr:last-child>td]:border-b-0 lg:[&_td:first-child]:border-r lg:[&_td:first-child]:bg-transparent"
          : ""
      }${userRole !== "ADMIN" ? " lg:[&_td]:py-2.5" : ""}`}>
        <tbody>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              복종
            </td>
            {/* PC: 값도 라벨과 같은 왼쪽 축에 맞춘다 (가운데 정렬이면 행마다 시선이 좌↔중앙을 왕복) */}
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-center lg:text-left">{getCategory(p?.Style_no)}</td>
          </tr>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              판매가
            </td>
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-center tabular-nums lg:text-left">{fmt(p?.Sale_price)}</td>
          </tr>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              혼용률
            </td>
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-center lg:text-left">{val(p?.Composition)}</td>
          </tr>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              상품설명
            </td>
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-left break-keep break-words leading-relaxed">
              {splitSentences(p?.Product_desc).length > 0
                ? splitSentences(p?.Product_desc).map((s, i) => (
                    <p key={i}>{s}</p>
                  ))
                : "-"}
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* 상세정보 (ADMIN/STAFF_1 전용).
          PC 패널에서는 기본정보와의 간격을 총평과의 간격(space-y-4 = 16px)과 같게 맞춘다 */}
      {drawerOpen && (userRole === "ADMIN" || userRole === "STAFF_1") && (
        <div className={spacedSections ? "mt-4" : undefined}>
          <button
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            className={`flex justify-between items-center w-full px-3 py-2.5 border-l border-r border-b border-muted-foreground/40 bg-background text-xs font-bold text-foreground transition-colors hover:bg-muted/30${
              userRole !== "ADMIN"
                ? ` lg:text-[13px] lg:border-black/[0.06] lg:bg-card lg:border-t lg:rounded-t-[10px]${!isDetailOpen ? " lg:rounded-b-[10px]" : ""}`
                : ""
            }`}
          >
            <span>상세정보</span>
            {isDetailOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* 행 패딩을 키우던 lg:[&>div]:py-4 는 제거 — 좌우 2단 시절 높이를 채우려던 규칙이라
              우측 단일 패널에서는 원가 10행이 160px씩 불어나 총평 입력란을 화면 밖으로 밀어냈다 */}
          {isDetailOpen && (
            <div className={`w-full border-l border-r border-b border-muted-foreground/40 text-xs text-left flex flex-col bg-background${userRole !== "ADMIN" ? " lg:text-[13px] lg:border-black/[0.06] lg:bg-card lg:rounded-b-[10px] lg:overflow-hidden" : ""}`}>
              <div className="flex items-start border-b border-muted-foreground/20 px-3 py-2">
                <span className="shrink-0 text-muted-foreground mr-2 w-24">· 원단명</span>
                <span className="text-foreground font-medium break-all flex-1 text-center">{p?.Fabric_name ?? "-"}</span>
              </div>
              <div className="flex items-start border-b border-muted-foreground/20 px-3 py-2">
                <span className="shrink-0 text-muted-foreground mr-2 w-24">· 혼용률</span>
                <span className="text-foreground font-medium break-all flex-1 text-center">{p?.Composition ?? "-"}</span>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· 원단폭</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">{p?.Fabric_width ?? "-"}</span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 단가</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">{fmt(p?.Unit_cost)}</span>
                </div>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· M/U</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">
                    {p?.Markup != null ? p.Markup.toFixed(2) : "-"}
                  </span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 요척</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">
                    {p?.Consumption != null ? p.Consumption.toFixed(2) : "-"}
                  </span>
                </div>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· 원자재</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">{fmt(p?.Raw_material_cost)}</span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 부자재</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">{fmt(p?.Sub_material_cost)}</span>
                </div>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· 특수부자재</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">{fmt(p?.Special_trim_cost)}</span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 공임</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center tabular-nums">{fmt(p?.Labor_cost)}</span>
                </div>
              </div>
              <div className="flex items-start border-b border-muted-foreground/20 px-3 py-2 bg-muted/30">
                <span className="shrink-0 text-foreground font-bold mr-2 w-24">· 제조원가</span>
                <span className="text-primary font-bold break-all flex-1 text-center tabular-nums">{fmt(p?.Mfg_cost)}</span>
              </div>
              <div className="flex items-center border-b border-muted-foreground/20 px-3 py-2">
                <div className="shrink-0 text-muted-foreground mr-2 w-24 flex flex-col leading-5">
                  <span>· 추가공임정보</span>
                </div>
                <span className="text-foreground font-medium whitespace-pre-wrap flex-1 text-center">{p?.Add_labor_info ?? "-"}</span>
              </div>
              <div className="flex items-center border-b border-muted-foreground/20 px-3 py-2">
                <div className="shrink-0 text-muted-foreground mr-2 w-24 flex flex-col leading-5">
                  <span>· 기타 원자재</span>
                  <span className="pl-2">정보</span>
                </div>
                <span className="text-foreground font-medium whitespace-pre-wrap flex-1 text-center">{p?.Etc_rawmat_info ?? "-"}</span>
              </div>
              <div className="flex items-center px-3 py-2">
                <div className="shrink-0 text-muted-foreground mr-2 w-24 flex flex-col leading-5">
                  <span>· MINI/DELI</span>
                  <span className="pl-2">재고/선발주</span>
                </div>
                <span className="text-foreground font-medium whitespace-pre-wrap flex-1 text-center">{p?.MINI_DELI_Stock_preorder ?? "-"}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StaffProductDetail = () => {
  // ⭐ 'index' 파라미터를 'styleCode'로 변경하여 라우터와 일치시킵니다.
  const { styleCode } = useParams<{ styleCode: string }>();
  const isNew = styleCode === "new";

  return (
    <ProductDetailShell
      routePrefix="staff-product"
      summaryTable={(drawerOpen: boolean, dbProduct: DbProduct | null) => (
        <StaffInfoSection drawerOpen={drawerOpen} dbProduct={dbProduct} spacedSections />
      )}
      isNew={isNew}
    />
  );
};

export default StaffProductDetail;
