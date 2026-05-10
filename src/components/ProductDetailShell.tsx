import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { useState, useRef, useEffect, useCallback } from "react";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db, storage } from "@/firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { normalizeStyleNo } from "@/lib/utils";

// 이미지 업로드 로직
const uploadImage = async (file: File, styleCode: string) => {
  const fileExt = file.name.split(".").pop() || "";
  const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const filePath = `${styleCode}/${Date.now()}_${baseName}.${fileExt}`;
  const storageRef = ref(storage, `product_image/${filePath}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

interface EvalRowProps {
  label: string;
  options: string[];
  selected: string | undefined;
  onSelect: (val: string) => void;
  hasError?: boolean;
}

const EvalRow = ({ label, options, selected, onSelect, hasError }: EvalRowProps) => (
  <div className="flex items-center gap-2">
    <span
      className={`w-16 shrink-0 text-xs font-medium transition-colors ${hasError ? "text-destructive" : "text-foreground"}`}
    >
      {label}
    </span>
    <div className="flex flex-1 gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors ${
            selected === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-foreground bg-background text-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

// ⭐ 모든 DB 컬럼 인터페이스 정의 (빌드 에러 해결)
export interface DbProduct {
  Style_no: string;
  Thumbnail_url: string | null;
  Product_image_urls: any;
  Coord_image_urls: any;
  Sale_price: number | null;
  Fabric_name: string | null;
  Composition: string | null;
  Fabric_width: string | null;
  Unit_cost: number | null;
  Markup: number | null;
  Consumption: number | null;
  Raw_material_cost: number | null;
  Sub_material_cost: number | null;
  Special_trim_cost: number | null;
  Labor_cost: number | null;
  Mfg_cost: number | null;
  Add_labor_info: string | null;
  Etc_rawmat_info: string | null;
  MINI_DELI_Stock_preorder: string | null;
}

interface ProductDetailShellProps {
  routePrefix: string;
  summaryTable: React.ReactNode | ((drawerOpen: boolean, dbProduct: DbProduct | null) => React.ReactNode);
  detailTable?: React.ReactNode;
  isNew?: boolean;
}

const ProductDetailShell = ({ routePrefix, summaryTable, detailTable, isNew }: ProductDetailShellProps) => {
  // ⭐ URL 파라미터에서 styleCode를 직접 가져옵니다.
  const { styleCode: urlStyleCode } = useParams<{ styleCode: string }>();
  const navigate = useNavigate();
  const { products, markProductEvaluated, updateEvaluation, evaluations, userRole, refreshData, userId, logout } =
    useAppContext();

  // ⭐ Fallback 제거: AppContext.userId를 단일 source of truth로 사용
  const currentUser = userId ?? "";

  // ⭐ 저장 시점 가드: userId가 없으면 평가 저장 차단 + 로그인 페이지로 이동
  const ensureAuthed = () => {
    if (!currentUser || currentUser.trim() === "") {
      toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
      logout();
      navigate("/");
      return false;
    }
    return true;
  };

  // 전체 상품 리스트에서 현재 품번의 순서(index)를 찾아 네비게이션에 활용합니다.
  const idx = products.findIndex((p) => p.styleCode === urlStyleCode);
  const product = products[idx];

  const [dbProduct, setDbProduct] = useState<DbProduct | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [currentCoordImages, setCurrentCoordImages] = useState<string[]>([]);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [coordImageFiles, setCoordImageFiles] = useState<File[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coordInputRef = useRef<HTMLInputElement>(null);

  const [purchaseIntent, setPurchaseIntent] = useState<string | undefined>(undefined);
  const [design, setDesign] = useState<string | undefined>(undefined);
  const [price, setPrice] = useState<string | undefined>(undefined);
  const [comment, setComment] = useState<string>("");
  const [editableStyleCode, setEditableStyleCode] = useState(urlStyleCode || "");

  // --- [데이터 페칭] ---
  const fetchDbProduct = useCallback(async () => {
    const sc = isNew ? editableStyleCode : urlStyleCode;
    if (!sc) return;

    try {
      const docRef = doc(db, "products", normalizeStyleNo(sc));
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setDbProduct(data as DbProduct);
        setCurrentThumbnail(data.Thumbnail_url);

        // ⭐ Json[] -> string[] 타입 에러 해결
        const pUrls = Array.isArray(data.Product_image_urls) ? data.Product_image_urls : [];
        const cUrls = Array.isArray(data.Coord_image_urls) ? data.Coord_image_urls : [];
        setCurrentImages(pUrls as any as string[]);
        setCurrentCoordImages(cUrls as any as string[]);
      }
    } catch (err) {
      console.error("Error fetching product:", err);
    }
  }, [urlStyleCode, isNew, editableStyleCode]);

  // 실시간 동기화 설정 (필터 적용)
  useEffect(() => {
    fetchDbProduct();
    if (isNew) return;

    const docRef = doc(db, "products", normalizeStyleNo(urlStyleCode));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      fetchDbProduct();
    });

    return () => {
      unsubscribe();
    };
  }, [urlStyleCode, fetchDbProduct, isNew]);

  // 기존 평가 데이터 로드 (역할별 올바른 컬럼 매핑)
  useEffect(() => {
    if (isNew || !urlStyleCode) return;
    const ex = (evaluations as any[]).find(
      (e) => normalizeStyleNo(String(e.Style_no)) === normalizeStyleNo(urlStyleCode) && e.Evaluator_ID === currentUser,
    );
    if (ex) {
      setPrice(ex.Price ?? undefined);
      setComment(ex.Comment ?? "");
      if (userRole === "STAFF_2") {
        setPurchaseIntent(ex.Purchase_intent ?? undefined);
      } else if (userRole === "STORE") {
        setDesign(ex.Order_count ?? undefined);
      }
    } else {
      setComment("");
    }
  }, [urlStyleCode, evaluations, isNew, currentUser, userRole]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentThumbnail(URL.createObjectURL(file));
    setThumbnailFile(file);
    e.target.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = 6 - currentImages.length;
    if (remainingSlots <= 0) {
      toast.error("단품 이미지는 최대 6개까지만 등록 가능합니다.");
      return;
    }
    const allowedFiles = files.slice(0, remainingSlots);
    const newImageUrls = allowedFiles.map((file) => URL.createObjectURL(file));
    setCurrentImages((prev) => [...prev, ...newImageUrls]);
    setImageFiles((prev) => [...prev, ...allowedFiles]);
    e.target.value = "";
  };

  const handleCoordFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = 6 - currentCoordImages.length;
    if (remainingSlots <= 0) {
      toast.error("코디 이미지는 최대 6개까지만 등록 가능합니다.");
      return;
    }
    const allowedFiles = files.slice(0, remainingSlots);
    const newImageUrls = allowedFiles.map((file) => URL.createObjectURL(file));
    setCurrentCoordImages((prev) => [...prev, ...newImageUrls]);
    setCoordImageFiles((prev) => [...prev, ...allowedFiles]);
    e.target.value = "";
  };



  const saveAndNavigate = async (direction: "prev" | "coordi") => {
    // ⭐ 평가 필수 입력 검증 제거: 평가 미입력 상태에서도 이전/다음 스타일로 자유롭게 이동 가능
    setShowErrors(false);

    if (userRole === "ADMIN" && direction === "coordi") {
      const sc = normalizeStyleNo(editableStyleCode.trim());
      if (!sc) return toast.error("품번을 입력하세요.");

      try {
        toast.loading("저장 중...", { id: "save-admin" });
        let thumbnailUrl = currentThumbnail;
        if (thumbnailFile) thumbnailUrl = await uploadImage(thumbnailFile, sc);

        let finalProductUrls = currentImages.filter((url) => url.startsWith("http"));
        if (imageFiles.length > 0) {
          const newUrls = await Promise.all(imageFiles.map((file) => uploadImage(file, sc)));
          finalProductUrls = [...finalProductUrls, ...newUrls];
        }

        let finalCoordUrls = currentCoordImages.filter((url) => url.startsWith("http"));
        if (coordImageFiles.length > 0) {
          const newCoordUrls = await Promise.all(coordImageFiles.map((file) => uploadImage(file, sc)));
          finalCoordUrls = [...finalCoordUrls, ...newCoordUrls];
        }

        const productRef = doc(db, "products", sc);
        await updateDoc(productRef, {
          Thumbnail_url: thumbnailUrl,
          Product_image_urls: finalProductUrls,
          Coord_image_urls: finalCoordUrls,
        });
        toast.dismiss("save-admin");
        toast.success("저장되었습니다.");
        refreshData();
        navigate("/gallery");
      } catch (err) {
        toast.dismiss("save-admin");
        toast.error("저장 중 오류가 발생했습니다.");
      }
      return;
    }

    if (!product) return;

    if (direction === "prev") {
      if (idx > 0) navigate(`/${routePrefix}/${products[idx - 1].styleCode}`);
    } else {
      const sc = normalizeStyleNo(product.styleCode);
      const currentProjectName = product.projectId;
      const evalDocId = `${currentUser}_${sc}`;
      const evalRef = doc(db, "evaluations", evalDocId);

      if (userRole === "STORE") {
        const trimmedComment = comment.trim();
        if (!price && !design && !trimmedComment) {
          navigate(`/coordi/${urlStyleCode}`);
          return;
        }
        if (!ensureAuthed()) return;
        try {
          toast.loading("평가 저장 중...", { id: "eval-save" });
          await setDoc(evalRef, {
            Style_no: sc,
            Evaluator_ID: currentUser,
            Price: price,
            Order_count: design,
            Comment: trimmedComment || null,
            Project_name: currentProjectName,
          }, { merge: true });

          updateEvaluation({
            Style_no: sc,
            Evaluator_ID: currentUser,
            Price: price,
            Order_count: design,
            Comment: trimmedComment || null,
            Project_name: currentProjectName,
          });
          markProductEvaluated(product.id);
          toast.dismiss("eval-save");
          navigate(`/coordi/${urlStyleCode}?evalId=${evalDocId}`);
        } catch (err) {
          toast.dismiss("eval-save");
          toast.error("평가 저장 중 오류가 발생했습니다.");
        }
      } else if (userRole === "STAFF_2") {
        const trimmedComment = comment.trim();
        if (!price && !purchaseIntent && !trimmedComment) {
          navigate(`/coordi/${urlStyleCode}`);
          return;
        }
        if (!ensureAuthed()) return;
        try {
          toast.loading("평가 저장 중...", { id: "eval-save" });
          await setDoc(evalRef, {
            Style_no: sc,
            Evaluator_ID: currentUser,
            Price: price,
            Purchase_intent: purchaseIntent,
            Comment: trimmedComment || null,
            Project_name: currentProjectName,
          }, { merge: true });

          updateEvaluation({
            Style_no: sc,
            Evaluator_ID: currentUser,
            Price: price,
            Purchase_intent: purchaseIntent,
            Comment: trimmedComment || null,
            Project_name: currentProjectName,
          });
          markProductEvaluated(product.id);
          toast.dismiss("eval-save");
          navigate(`/coordi/${urlStyleCode}?evalId=${evalDocId}`);
        } catch (err) {
          toast.dismiss("eval-save");
          toast.error("평가 저장 중 오류가 발생했습니다.");
        }
      } else {
        const trimmedComment = comment.trim();
        if (!trimmedComment) {
          navigate(`/coordi/${urlStyleCode}`);
          return;
        }
        if (!ensureAuthed()) return;
        try {
          toast.loading("평가 저장 중...", { id: "eval-save" });
          await setDoc(evalRef, {
            Style_no: sc,
            Evaluator_ID: currentUser,
            Comment: trimmedComment,
            Project_name: currentProjectName,
          }, { merge: true });

          updateEvaluation({
            Style_no: sc,
            Evaluator_ID: currentUser,
            Comment: trimmedComment,
            Project_name: currentProjectName,
          });
          markProductEvaluated(product.id);
          toast.dismiss("eval-save");
          navigate(`/coordi/${urlStyleCode}`);
        } catch (err) {
          toast.dismiss("eval-save");
          toast.error("평가 저장 중 오류가 발생했습니다.");
        }
      }
    }
  };

  const currentDisplayCode = userRole === "ADMIN" ? editableStyleCode : isNew ? "NEW_STYLE" : urlStyleCode;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <div className="sticky top-0 z-20 relative flex shrink-0 items-center justify-between bg-background px-4 py-3">
        <button onClick={() => navigate("/gallery")} className="text-foreground">
          <LayoutGrid className="h-5 w-5" />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          {userRole === "ADMIN" ? (
            <input
              type="text"
              value={editableStyleCode}
              onChange={(e) => setEditableStyleCode(normalizeStyleNo(e.target.value))}
              className="w-32 border border-foreground bg-background px-2 py-0.5 text-center text-sm font-bold uppercase"
              placeholder="품번 입력"
            />
          ) : (
            <span className="border border-foreground px-2 py-0.5 text-sm font-bold">{currentDisplayCode}</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{isNew ? "NEW" : `${idx + 1}/${products.length}`}</div>
      </div>

      {userRole === "ADMIN" ? (
        <div className="pt-6 space-y-10 pb-10">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={thumbnailInputRef}
            onChange={handleThumbnailChange}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={coordInputRef}
            onChange={handleCoordFileChange}
          />
          <div className="flex flex-col items-center">
            <p className="text-sm font-bold text-muted-foreground mb-2">썸네일 이미지</p>
            {currentThumbnail ? (
              <div className="w-[160px] aspect-[2/3] relative rounded-md overflow-hidden">
                <img src={currentThumbnail} className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setCurrentThumbnail(null);
                    setThumbnailFile(null);
                  }}
                  className="absolute bottom-2 left-2 bg-background/80 p-1 text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => thumbnailInputRef.current?.click()}
                className="w-[160px] aspect-[2/3] border-2 border-dashed border-muted-foreground/30 bg-white flex items-center justify-center cursor-pointer rounded-md"
              >
                <Plus className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4 bg-white">
          <div className="relative w-full aspect-[2/3] shrink-0 overflow-hidden rounded-lg">
            <div
              ref={scrollRef}
              onScroll={() => {
                if (scrollRef.current)
                  setActiveImage(Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth));
              }}
              className="flex h-full snap-x snap-mandatory overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {currentImages.map((src, i) => (
                <div key={i} className="relative w-full shrink-0 snap-center rounded-lg overflow-hidden bg-white aspect-[2/3]">
                  <img src={src} className="w-full h-full object-cover" alt={`coord-${i}`} />
                </div>
              ))}
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
              {currentImages.map((_, i) => (
                <div key={i} className={`h-1.5 w-1.5 rounded-full ${i === activeImage ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-background px-4 pt-4 pb-10">
        {typeof summaryTable === "function" ? summaryTable(true, dbProduct) : summaryTable}

        {userRole !== "ADMIN" && (
          <div className="mt-4 space-y-4">
            {detailTable}
            {userRole === "STAFF_2" && (
              <div className="rounded-md border border-foreground p-3">
                <h3 className="mb-3 text-sm font-bold">의견을 남겨주세요.</h3>
                <div className="space-y-3">
                  <EvalRow
                    label="가격"
                    options={["저렴", "적정", "비쌈"]}
                    selected={price}
                    onSelect={setPrice}
                    hasError={showErrors && !price}
                  />
                  <EvalRow
                    label="구매의사"
                    options={["보류", "관심", "구매함"]}
                    selected={purchaseIntent}
                    onSelect={setPurchaseIntent}
                    hasError={showErrors && !purchaseIntent}
                  />
                </div>
              </div>
            )}
            {userRole === "STORE" && (
              <div className="rounded-md border border-foreground p-3">
                <h3 className="mb-3 text-sm font-bold">의견을 남겨주세요.</h3>
                <div className="space-y-3">
                  <EvalRow
                    label="가격"
                    options={["저렴", "적정", "비쌈"]}
                    selected={price}
                    onSelect={setPrice}
                    hasError={showErrors && !price}
                  />
                  <EvalRow
                    label="희망주문량"
                    options={["2장이내", "5장이내", "10장이내"]}
                    selected={design}
                    onSelect={setDesign}
                    hasError={showErrors && !design}
                  />
                </div>
              </div>
            )}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="총평을 남겨주세요 (선택 사항)"
              className="w-full h-20 border rounded-lg p-3 text-sm resize-none"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => saveAndNavigate("prev")}
                disabled={idx <= 0}
                className="flex-1 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-30"
              >
                &lt; 이전 스타일
              </button>
              <button
                onClick={() => saveAndNavigate("coordi")}
                className="flex-1 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground"
              >
                스타일링 선호도
              </button>
            </div>
          </div>
        )}

        {userRole === "ADMIN" && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => saveAndNavigate("coordi")}
              className="flex-1 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground"
            >
              스타일 등록
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailShell;
