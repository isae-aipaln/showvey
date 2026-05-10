import ProductDetailShell, { DbProduct } from "@/components/ProductDetailShell";

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

const GuestSummaryTable = ({ dbProduct }: { dbProduct: DbProduct | null }) => {
  const p = dbProduct;
  return (
    <table className="w-full border-collapse border border-foreground text-sm">
      <tbody>
        <tr className="border-b border-foreground">
          <td className="w-24 border-r border-foreground px-3 py-2 font-medium text-muted-foreground">복종</td>
          <td className="px-3 py-2">{getCategory(p?.Style_no)}</td>
        </tr>
        <tr className="border-b border-foreground">
          <td className="w-24 border-r border-foreground px-3 py-2 font-medium text-muted-foreground">판매가</td>
          <td className="px-3 py-2">{fmt(p?.Sale_price)}</td>
        </tr>
        <tr>
          <td className="border-r border-foreground px-3 py-2 font-medium text-muted-foreground">혼용률</td>
          <td className="px-3 py-2">{p?.Composition ?? "-"}</td>
        </tr>
      </tbody>
    </table>
  );
};

const GuestProductDetail = () => (
  <ProductDetailShell
    routePrefix="guest-product"
    summaryTable={(_drawerOpen: boolean, dbProduct: DbProduct | null) => <GuestSummaryTable dbProduct={dbProduct} />}
  />
);

export default GuestProductDetail;
