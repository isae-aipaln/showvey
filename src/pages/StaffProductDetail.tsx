import { useParams } from "react-router-dom";
import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import ProductDetailShell, { DbProduct } from "@/components/ProductDetailShell";
import { useAppContext } from "@/context/AppContext";

const fmt = (v: number | null | undefined) => (v != null ? v.toLocaleString() : "-");

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

const StaffInfoSection = ({ drawerOpen, dbProduct }: { drawerOpen: boolean; dbProduct: DbProduct | null }) => {
  const { userRole } = useAppContext();
  // 임직원1(STAFF_1)은 페이지 진입 시 상세정보가 자동으로 펼쳐진 상태로 시작 (접기 토글은 그대로 사용 가능)
  const [isDetailOpen, setIsDetailOpen] = useState(userRole === "STAFF_1");
  const p = dbProduct;

  return (
    /* 기본정보와 상세정보는 전 기기에서 세로로 쌓임. 임직원1 PC에서는 열 전체 높이를 채우도록 상세정보 박스가 늘어남 */
    <div className={`w-full mb-4${userRole !== "ADMIN" ? " lg:mb-0 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:justify-between" : ""}`}>
      {/* 기본정보 테이블 — 임직원2/매장 PC에서는 옆의 평가박스 높이에 맞춰 행이 늘어남 */}
      <div className={userRole === "STAFF_2" || userRole === "STORE" ? "lg:flex-1 lg:min-h-0" : undefined}>
      <table className={`w-full border-collapse border border-muted-foreground/40 text-xs text-left mb-0${
        /* PC: 라운드 모서리 적용 (border-collapse에선 radius가 안 먹어 separate로 전환하고 셀 테두리를 구분선 방식으로 변경) */
        userRole !== "ADMIN"
          ? " lg:border-separate lg:border-spacing-0 lg:rounded-lg lg:overflow-hidden lg:[&_td]:border-0 lg:[&_td]:border-b lg:[&_td]:border-muted-foreground/40 lg:[&_tr:last-child>td]:border-b-0 lg:[&_td:first-child]:border-r"
          : ""
      }${
        userRole === "STAFF_1"
          ? " lg:[&_td]:py-3" /* 임직원1 PC: 기본정보 행 높이를 살짝만 키움 */
          : userRole === "STAFF_2" || userRole === "STORE"
            ? " lg:h-full"
            : ""
      }`}>
        <tbody>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              복종
            </td>
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-center">{getCategory(p?.Style_no)}</td>
          </tr>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              판매가
            </td>
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-center">{fmt(p?.Sale_price)}</td>
          </tr>
          <tr>
            <td className="border border-muted-foreground/40 px-3 py-2 text-muted-foreground font-medium w-1/4 bg-muted/30">
              혼용률
            </td>
            <td className="border border-muted-foreground/40 px-3 py-2 text-foreground text-center">{p?.Composition ?? "-"}</td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* 상세정보 (ADMIN/STAFF_1 전용) */}
      {/* 임직원1 PC: 상세정보는 콘텐츠 높이만큼만 차지하고 열 하단(총평 하단 라인)에 붙음 — 남는 여백은 기본정보와의 사이에 배치 */}
      {drawerOpen && (userRole === "ADMIN" || userRole === "STAFF_1") && (
        <div>
          <button
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            className={`flex justify-between items-center w-full px-3 py-2.5 border-l border-r border-b border-muted-foreground/40 bg-background text-xs font-bold text-foreground transition-colors hover:bg-muted/30${userRole === "STAFF_1" ? ` lg:border-t lg:rounded-t-lg${!isDetailOpen ? " lg:rounded-b-lg" : ""}` : ""}`}
          >
            <span>상세정보</span>
            {isDetailOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {isDetailOpen && (
            <div className={`w-full border-l border-r border-b border-muted-foreground/40 text-xs text-left flex flex-col bg-background${userRole === "STAFF_1" ? " lg:[&>div]:py-4 lg:rounded-b-lg lg:overflow-hidden" : ""}`}>
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
                  <span className="text-foreground font-medium break-all flex-1 text-center">{fmt(p?.Unit_cost)}</span>
                </div>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· M/U</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">
                    {p?.Markup != null ? p.Markup.toFixed(2) : "-"}
                  </span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 요척</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">
                    {p?.Consumption != null ? p.Consumption.toFixed(2) : "-"}
                  </span>
                </div>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· 원자재</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">{fmt(p?.Raw_material_cost)}</span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 부자재</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">{fmt(p?.Sub_material_cost)}</span>
                </div>
              </div>
              <div className="flex border-b border-muted-foreground/20 px-3 py-2">
                <div className="w-1/2 flex items-start pr-2">
                  <span className="shrink-0 text-muted-foreground mr-2">· 특수부자재</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">{fmt(p?.Special_trim_cost)}</span>
                </div>
                <div className="w-1/2 flex items-start">
                  <span className="shrink-0 text-muted-foreground mr-2">· 공임</span>
                  <span className="text-foreground font-medium break-all flex-1 text-center">{fmt(p?.Labor_cost)}</span>
                </div>
              </div>
              <div className="flex items-start border-b border-muted-foreground/20 px-3 py-2 bg-muted/30">
                <span className="shrink-0 text-foreground font-bold mr-2 w-24">· 제조원가</span>
                <span className="text-primary font-bold break-all flex-1 text-center">{fmt(p?.Mfg_cost)}</span>
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
        <StaffInfoSection drawerOpen={drawerOpen} dbProduct={dbProduct} />
      )}
      isNew={isNew}
    />
  );
};

export default StaffProductDetail;
