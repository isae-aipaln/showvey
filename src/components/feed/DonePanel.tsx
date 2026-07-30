import { useAppContext } from "@/context/AppContext";
import { findMyEvaluation } from "@/lib/evaluationSave";
import ResilientImage from "@/components/ResilientImage";

interface DonePanelProps {
  onOpenEval: (product: any) => void;
}

// 완료현황 탭: 평가 완료한 스타일 목록 — 행을 탭하면 평가 시트가 열려 바로 수정 가능
const DonePanel = ({ onOpenEval }: DonePanelProps) => {
  const { products, evaluations, userId, userRole } = useAppContext();
  const currentUser = userId ?? "";

  const doneItems = products
    .map((p, i) => ({ product: p, seq: i + 1, ev: findMyEvaluation(evaluations, p.styleCode, currentUser) }))
    .filter((item) => !!item.ev);

  const summaryOf = (ev: any): string => {
    const parts: string[] = [];
    if (ev.Price) parts.push(`가격 ${ev.Price}`);
    if (userRole === "STAFF_2" && ev.Purchase_intent) parts.push(`구매의사 ${ev.Purchase_intent}`);
    if (userRole === "STORE" && ev.Order_count) parts.push(`예상판매 ${ev.Order_count}`);
    if (ev.Comment) parts.push("총평 ✓");
    if (Array.isArray(ev.Liked_images) && ev.Liked_images.length > 0) parts.push(`♥ ${ev.Liked_images.length}`);
    return parts.join(" · ") || "입력 내용 없음";
  };

  return (
    <div className="px-4 py-3">
      <p className="mb-3 text-sm font-bold">
        완료 <span className="text-[hsl(var(--eval-blue))]">{doneItems.length}</span>
        <span className="text-muted-foreground font-medium"> / 전체 {products.length}</span>
      </p>
      {doneItems.length === 0 ? (
        <p className="py-16 text-center text-xs text-muted-foreground">아직 평가한 스타일이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-muted">
          {doneItems.map(({ product, seq, ev }) => {
            const badgeLabel = product.displayNo ? String(product.displayNo) : String(seq);
            return (
              <li key={product.id}>
                <button onClick={() => onOpenEval(product)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-white border border-muted">
                    {product.thumbnailImage ? (
                      <ResilientImage
                        src={product.thumbnailImage}
                        alt={product.styleCode}
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      <span className="mr-1.5 text-[hsl(var(--eval-blue))]">{badgeLabel}</span>
                      {product.styleCode}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{summaryOf(ev)}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DonePanel;
