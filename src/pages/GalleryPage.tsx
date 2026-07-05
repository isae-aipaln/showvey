import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Trash2, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { db, storage } from "@/firebase";
import { collection, query, where, getDocs, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { normalizeStyleNo } from "@/lib/utils";
import { exportCommentsToExcel, shareCommentsExcel } from "@/lib/exportComments";

const GalleryPage = () => {
  const { userRole, logout, products, evaluations, refreshData, isRandomized, userId } = useAppContext();
  const navigate = useNavigate();
  const [exitOpen, setExitOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem("galleryPage");
    return saved ? Number(saved) : 1;
  });
  const itemsPerPage = 6;

  useEffect(() => {
    sessionStorage.setItem("galleryPage", String(currentPage));
  }, [currentPage]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage]);

  const totalPages = Math.ceil(products.length / itemsPerPage);

  const pageRange = useMemo(() => {
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages = [];
    for (let i = start; i <= end; i++) {
      if (i >= 1 && i <= totalPages) {
        pages.push(i);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  const routePrefix = "/staff-product";
  // ⭐ Fallback 제거: AppContext.userId를 단일 source of truth로 사용 (읽기 전용 — 평가 카운트 표시에만 사용)
  const currentUser = userId ?? "";
  const checkIsEvaluated = (styleCode: string) => {
    return (evaluations as any[]).some(
      (e) => normalizeStyleNo(String(e.Style_no)) === normalizeStyleNo(styleCode) && e.Evaluator_ID === currentUser,
    );
  };

  const evaluatedCount = useMemo(() => {
    return products.filter((p) => checkIsEvaluated(p.styleCode)).length;
  }, [products, evaluations, currentUser]);

  const handleExit = () => {
    setExitOpen(false);
    logout();
    navigate("/");
  };
  const handleAdminComplete = () => {
    toast.success("모든 등록 사항이 저장되었습니다.");
    logout();
    navigate("/");
  };

  const handleDelete = async (e: React.MouseEvent, styleCode: string) => {
    e.stopPropagation();
    if (!window.confirm(`${styleCode}의 데이터를 초기화하시겠습니까?`)) return;

    try {
      toast.loading("데이터 초기화 중...", { id: "delete-process" });
      const sc = normalizeStyleNo(styleCode);

      const folderRef = ref(storage, `product_image/${sc}`);
      try {
        const fileList = await listAll(folderRef);
        await Promise.all(fileList.items.map(fileRef => deleteObject(fileRef)));
      } catch (e) {
        console.error("Storage delete error:", e);
      }

      const evalsRef = collection(db, "evaluations");
      const qEvals = query(evalsRef, where("Style_no", "==", sc));
      const evalSnapshot = await getDocs(qEvals);
      await Promise.all(evalSnapshot.docs.map(d => deleteDoc(d.ref)));

      const productRef = doc(db, "products", sc);
      await updateDoc(productRef, { Thumbnail_url: null, Product_image_urls: null, Coord_image_urls: null });
      toast.dismiss("delete-process");
      toast.success(`${sc} 데이터가 초기화되었습니다.`);
      refreshData();
    } catch (error) {
      toast.dismiss("delete-process");
      toast.error("초기화 중 오류가 발생했습니다.");
    }
  };

  const handleDownloadComments = async () => {
    if (!currentUser) {
      toast.error("로그인 정보가 없습니다.");
      return;
    }
    try {
      toast.loading("엑셀 파일 생성 중...", { id: "export-comments" });
      const { count } = await exportCommentsToExcel({
        evaluations: evaluations as any[],
        products: products as any[],
        evaluatorId: currentUser,
      });
      toast.dismiss("export-comments");
      toast.success(`${count}건의 메모를 엑셀로 내려받았습니다.`);
    } catch (err: any) {
      toast.dismiss("export-comments");
      toast.error(err?.message ?? "엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  const handleShareComments = async () => {
    if (!currentUser) {
      toast.error("로그인 정보가 없습니다.");
      return;
    }
    try {
      toast.loading("엑셀 파일 생성 중...", { id: "share-comments" });
      const { count, method } = await shareCommentsExcel({
        evaluations: evaluations as any[],
        products: products as any[],
        evaluatorId: currentUser,
      });
      toast.dismiss("share-comments");
      if (method === "share") {
        toast.success(`${count}건의 메모를 공유했습니다.`);
      } else {
        toast.success(`공유를 지원하지 않아 ${count}건의 메모를 다운로드했습니다.`);
      }
    } catch (err: any) {
      toast.dismiss("share-comments");
      if (err?.name === "AbortError") return;
      toast.error(err?.message ?? "공유 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <div className="shrink-0 flex items-center justify-between bg-background p-4 border-b border-muted">
        <div className="flex items-center gap-2">
          <div className="border border-foreground px-3 py-1 text-sm font-medium">Total {products.length}</div>
        </div>
        {userRole === "ADMIN" ? (
          <button
            onClick={handleAdminComplete}
            className="border border-foreground px-3 py-1 text-sm font-bold text-center hover:bg-foreground hover:text-background"
          >
            수정 완료
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {userRole !== "STORE" && (
              <>
                <button
                  onClick={handleShareComments}
                  aria-label="메모 엑셀 공유"
                  className="flex h-7 w-7 items-center justify-center border border-foreground hover:bg-foreground hover:text-background"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDownloadComments}
                  aria-label="메모 엑셀 다운로드"
                  className="flex h-7 w-7 items-center justify-center border border-foreground hover:bg-foreground hover:text-background"
                >
                  <Download className="h-4 w-4" />
                </button>
              </>
            )}
            <Dialog open={exitOpen} onOpenChange={setExitOpen}>
              <DialogTrigger asChild>
                <div className="cursor-pointer border border-foreground px-3 py-1 text-sm font-medium">
                  품평 완료 <span className="text-[hsl(var(--eval-blue))]">{evaluatedCount}</span>
                </div>
              </DialogTrigger>
              <DialogContent className="flex max-w-xs flex-col items-center gap-6 rounded-2xl p-8">
                <p className="text-center text-sm font-medium">
                  품평이 완료되었습니다.
                  <br />
                  참여해주셔서 감사합니다.
                </p>
                <button
                  onClick={handleExit}
                  className="w-full rounded-full bg-primary py-3 text-sm text-primary-foreground"
                >
                  나가기
                </button>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 content-start">
          {userRole === "ADMIN" && currentPage === 1 && (
            <div
              onClick={() => navigate("/staff-product/new")}
              className="relative w-full aspect-[2/3] cursor-pointer overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/30 bg-white flex items-center justify-center"
            >
              <Plus className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          {paginatedProducts.map((product) => {
            const isEvaluatedByMe = checkIsEvaluated(product.styleCode);
            const sequenceNumber = products.findIndex((p) => p.id === product.id) + 1;
            return (
              <div
                key={product.id}
                onClick={() => navigate(`${routePrefix}/${product.styleCode}`)}
                className="relative w-full aspect-[2/3] cursor-pointer overflow-hidden rounded-md bg-white"
              >
                {product.thumbnailImage ? (
                  <img
                    src={product.thumbnailImage}
                    alt={product.styleCode}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white">
                    {/* 이미지가 하나도 없을 때 품번 표시 (상품이미지, 코디이미지도 모두 없을 때) */}
                    {product.productImages.length === 0 && product.coordiImages.length === 0 ? (
                      <p className="text-sm font-bold text-foreground break-all px-3 text-center leading-snug">{product.styleCode}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No Image</p>
                    )}
                  </div>
                )}
                <div
                  className={`absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${isEvaluatedByMe
                      ? "bg-[hsl(var(--eval-blue))] border-[hsl(var(--eval-blue))] text-white"
                      : "bg-transparent border-foreground text-foreground"
                    }`}
                >
                  {sequenceNumber}
                </div>
                {userRole === "ADMIN" && (
                  <button
                    onClick={(e) => handleDelete(e, product.styleCode)}
                    className="absolute bottom-2 left-2 z-10 rounded-md bg-white/90 p-1.5 shadow-sm transition-transform"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 w-full bg-background px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] border-t border-muted flex flex-col gap-3">
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 disabled:opacity-30"
            >
              &lt;
            </button>
            <div className="flex gap-3">
              {pageRange.map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`${currentPage === page ? "font-bold text-foreground" : ""}`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 disabled:opacity-30"
            >
              &gt;
            </button>
          </div>
        )}
        <button
          onClick={() => products.length > 0 && navigate(`${routePrefix}/${products[0].styleCode}`)}
          className="w-full rounded-full bg-primary h-12 text-sm font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
        >
          품평 시작하기
        </button>
      </div>
    </div>
  );
};

export default GalleryPage;
