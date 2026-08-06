import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, Expand, Heart } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import { toast } from "sonner";
import { db, storage } from "@/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { uploadProductImage } from "@/lib/uploadProductImage";
import { normalizeStyleNo } from "@/lib/utils";
import EvalRow from "@/components/EvalRow";
import ImageThumbStrip from "@/components/ImageThumbStrip";
import ImagePane from "@/components/pc/ImagePane";
import ResilientImage from "@/components/ResilientImage";
import { useIsDesktop, useIsDesktopViewport, useForceMobile } from "@/hooks/use-desktop";
import { PC_PANEL } from "@/components/pc/pcLayout";
import { useEvaluationDraft } from "@/hooks/use-evaluation-draft";
import FeedList from "@/components/feed/FeedList";
import EvaluationSheet from "@/components/feed/EvaluationSheet";

// 이미지 업로드 — 관리자 품평상세와 같은 압축(JPEG 변환 + 0.5MB/1200px)을 거친다.
// 예전에는 이 경로만 원본을 그대로 올려 용량·화질 규칙이 화면마다 달랐다.
const uploadImage = (file: File, styleCode: string) => uploadProductImage(file, styleCode, "product");

/**
 * 총평 입력창. PC에서는 내용에 맞춰 높이가 자라고(최대 40vh), 모바일은 기존 고정 높이 그대로.
 * PC에서 남는 공간을 전부 차지하면 거대한 빈 상자가 되어 "길게 써야 한다"는 압박만 준다.
 */
const CommentBox = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!isDesktop) {
      el.style.height = ""; // 모바일 화면 보기로 전환 시 PC에서 잡은 인라인 높이 제거
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, isDesktop]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="메모를 입력해주세요"
      className={className}
    />
  );
};

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
  Product_desc?: string | null;
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
  const { products, userRole, refreshData } = useAppContext();
  const isDesktop = useIsDesktop();
  const isDesktopViewport = useIsDesktopViewport();
  const forceMobileView = useForceMobile();

  // 전체 상품 리스트에서 현재 품번의 순서(index)를 찾아 네비게이션에 활용합니다.
  const idx = products.findIndex((p) => p.styleCode === urlStyleCode);
  const product = products[idx];

  const [dbProduct, setDbProduct] = useState<DbProduct | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [currentCoordImages, setCurrentCoordImages] = useState<string[]>([]);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null);

  // 이미지가 하나도 없는 스타일 여부 (주의: dbProduct가 로드된 시점에만 true, 로딩중에는 false)
  const hasNoImages = dbProduct !== null && !currentThumbnail && currentImages.length === 0 && currentCoordImages.length === 0;

  // 상품정보 슬라이더에 표시할 이미지: 단품 + 코디 통합 (중복 URL 제거 — 모바일 피드와 동일 규칙)
  const sliderImages = Array.from(new Set([...currentImages, ...currentCoordImages].filter(Boolean)));

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [coordImageFiles, setCoordImageFiles] = useState<File[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coordInputRef = useRef<HTMLInputElement>(null);

  // 이미지 클릭 시 확대 팝업으로 표시할 이미지 URL (null이면 팝업 닫힘)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // 좁은 창(모바일 화면)에서 여는 평가 시트 대상
  const [sheetTarget, setSheetTarget] = useState<any>(null);

  // 좋아요 팝 모션: 이미지 영역 중앙 → 하트 버튼으로 날아가는 이동량을 트리거 시점에 실측
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const heartBtnRef = useRef<HTMLButtonElement>(null);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [flyOffset, setFlyOffset] = useState({ x: 0, y: 0 });

  // PC 화살표 클릭 시 해당 인덱스 이미지로 스크롤 (표시 상태는 즉시 갱신, 스크롤은 부드럽게 따라감)
  const scrollToImage = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, sliderImages.length - 1));
    setActiveImage(clamped);
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  // 스타일 이동 시 슬라이더를 첫 이미지로 리셋 (순번 표시가 남는 것 방지)
  // 갤러리 '이어보기'가 참조할 마지막 열람 품번도 함께 기록
  useEffect(() => {
    setActiveImage(0);
    scrollRef.current?.scrollTo({ left: 0 });
    if (urlStyleCode && !isNew) sessionStorage.setItem("lastViewedStyle", urlStyleCode);
  }, [urlStyleCode, isNew]);

  // 평가 입력 상태 + 자동저장/좋아요 즉시저장/열람 마킹을 훅이 전담 (저장 규칙은 lib/evaluationSave 정본)
  const {
    price, setPrice,
    purchaseIntent, setPurchaseIntent,
    orderCount: design, setOrderCount: setDesign,
    comment, setComment,
    likedUrls, toggleLike,
    saveState, flush,
  } = useEvaluationDraft(product, !isNew && userRole !== "ADMIN");

  // 현재 보고 있는 슬라이더 이미지의 좋아요 토글 (켜질 때만 중앙 하트 팝)
  const currentSliderUrl = sliderImages[Math.min(activeImage, Math.max(sliderImages.length - 1, 0))];
  const triggerHeartPop = () => {
    const area = imageAreaRef.current?.getBoundingClientRect();
    const btn = heartBtnRef.current?.getBoundingClientRect();
    setFlyOffset(
      area && btn
        ? {
            x: btn.left + btn.width / 2 - (area.left + area.width / 2),
            y: btn.top + btn.height / 2 - (area.top + area.height / 2),
          }
        : { x: 0, y: 0 },
    );
    setShowHeartPop(true);
    window.setTimeout(() => setShowHeartPop(false), 1050);
  };
  const toggleCurrentLike = () => {
    if (!currentSliderUrl) return;
    if (toggleLike(currentSliderUrl)) triggerHeartPop(); // 등록 시에만 팝 (해제 시에는 없음)
  };

  // 모바일 단일 슬라이더용 키보드 이동 (PC는 2업 페인이 따로 처리)
  useEffect(() => {
    if (isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (lightboxSrc) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if (sliderImages.length < 2) return;
      e.preventDefault();
      scrollToImage(activeImage + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeImage, sliderImages.length, lightboxSrc, isDesktop]);

  // ── PC 2업 비교 뷰 상태 ────────────────────────────────────
  // 세로 사진이라 사진 하나는 폭 600px가 한계다. 남는 폭을 여백으로 버리지 않고
  // 단품·코디를 나란히 놓아 "디테일과 착장을 동시에 판단"하는 데 쓴다 (Lightroom Compare 방식).
  const isPcReviewer = isDesktop && userRole !== "ADMIN";
  // 두 페인이 공유하는 스트립 표시 여부 (한쪽만 여러 장이어도 양쪽 프레임 아랫변을 맞춘다)
  const stripReserved = currentImages.length > 1 || currentCoordImages.length > 1;
  // 역할과 무관하게 같은 폭 — 폭이 달라지면 남는 여백도 달라져 화면마다 좌우 여백이 어긋난다.
  // (상세정보 값은 짧아서 420px로 충분하다)
  const panelWidth = 420;

  /**
   * 사진 영역 치수를 두 페인이 함께 계산한다.
   *
   * 높이만 보고 페인 폭을 정하면 역할별 패널 폭 차이(420 vs 560)를 반영하지 못해
   * 임직원1에서 합계가 화면을 넘치고 좌우 여백이 무너진다.
   * 그래서 '남은 가로 폭이 허용하는 높이'와 '화면 높이' 중 작은 쪽을 공통 높이로 잡는다.
   */
  const PANE_GAP = 20;
  const GROUP_GAP = 28;
  const STRIP_BLOCK = 68;
  const photoAreaRef = useRef<HTMLDivElement>(null);
  const paneRatios: number[] = [];
  if (currentImages.length > 0) paneRatios.push(2 / 3);
  if (currentCoordImages.length > 0) paneRatios.push(3 / 4);
  const ratioKey = paneRatios.join(",");
  const [photoBox, setPhotoBox] = useState<{ h: number; widths: number[]; heights: number[] }>({ h: 0, widths: [], heights: [] });

  useEffect(() => {
    const el = photoAreaRef.current;
    const ratios = ratioKey ? ratioKey.split(",").map(Number) : [];
    if (!el || !isPcReviewer || ratios.length === 0) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const innerW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const innerH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const forPhotos = innerW - panelWidth - GROUP_GAP - PANE_GAP * (ratios.length - 1);
      const sum = ratios.reduce((a, b) => a + b, 0);
      const h = Math.max(
        0,
        Math.floor(Math.min(innerH - (stripReserved ? STRIP_BLOCK : 0), forPhotos / sum)),
      );
      const widths = ratios.map((r) => Math.floor(h * r));
      const heights = ratios.map(() => h);
      setPhotoBox((prev) =>
        prev.h === h && prev.widths.join() === widths.join() ? prev : { h, widths, heights },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPcReviewer, ratioKey, stripReserved, panelWidth]);

  const productPaneIdx = 0;
  const coordPaneIdx = currentImages.length > 0 ? 1 : 0;
  const productPaneWidth = currentImages.length > 0 ? photoBox.widths[productPaneIdx] : undefined;
  const productPaneHeight = currentImages.length > 0 ? photoBox.heights[productPaneIdx] : undefined;
  const coordPaneWidth = currentCoordImages.length > 0 ? photoBox.widths[coordPaneIdx] : undefined;
  const coordPaneHeight = currentCoordImages.length > 0 ? photoBox.heights[coordPaneIdx] : undefined;
  const [paneIndex, setPaneIndex] = useState({ product: 0, coord: 0 });
  const [activePane, setActivePane] = useState<"product" | "coord">("product");
  useEffect(() => {
    setPaneIndex({ product: 0, coord: 0 });
    setActivePane("product");
  }, [urlStyleCode]);

  const paneImages = activePane === "product" ? currentImages : currentCoordImages;
  useEffect(() => {
    if (!isPcReviewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (lightboxSrc || paneImages.length < 2) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setPaneIndex((prev) => {
        const next = prev[activePane] + (e.key === "ArrowRight" ? 1 : -1);
        return { ...prev, [activePane]: Math.max(0, Math.min(next, paneImages.length - 1)) };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPcReviewer, activePane, paneImages.length, lightboxSrc]);
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
    const remainingSlots = 15 - currentImages.length;
    if (remainingSlots <= 0) {
      toast.error("단품 이미지는 최대 15개까지만 등록 가능합니다.");
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
    const remainingSlots = 10 - currentCoordImages.length;
    if (remainingSlots <= 0) {
      toast.error("코디 이미지는 최대 10개까지만 등록 가능합니다.");
      return;
    }
    const allowedFiles = files.slice(0, remainingSlots);
    const newImageUrls = allowedFiles.map((file) => URL.createObjectURL(file));
    setCurrentCoordImages((prev) => [...prev, ...newImageUrls]);
    setCoordImageFiles((prev) => [...prev, ...allowedFiles]);
    e.target.value = "";
  };



  // ADMIN 전용: 신규/기존 스타일의 이미지를 업로드하고 products 문서에 반영
  const saveAdminProduct = async () => {
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
  };

  // 스타일 이동: 미저장분을 먼저 반영한 뒤 이동 (자동저장이 대기 중일 수 있으므로 flush 필수)
  const goToStyle = async (delta: -1 | 1) => {
    if (!(await flush())) return;
    const next = idx + delta;
    if (next < 0) return;
    if (next < products.length) {
      navigate(`/${routePrefix}/${products[next].styleCode}`);
    } else {
      toast("모든 품평을 마쳤습니다. 감사합니다!");
      navigate("/gallery");
    }
  };

  const exitToGallery = async () => {
    await flush();
    navigate("/gallery");
  };


  // 역할별 평가 항목 (STAFF_1은 총평만 — 빈 배열이면 패널 자체를 렌더하지 않음)
  const evalRows =
    userRole === "STAFF_2"
      ? [
          { label: "가격", options: ["저렴", "적정", "비쌈"], selected: price, onSelect: setPrice },
          { label: "구매의사", options: ["보류", "관심", "구매함"], selected: purchaseIntent, onSelect: setPurchaseIntent },
        ]
      : userRole === "STORE"
        ? [
            { label: "가격", options: ["저렴", "적정", "비쌈"], selected: price, onSelect: setPrice },
            { label: "예상판매수량", options: ["2장이내", "5장이내", "10장이내"], selected: design, onSelect: setDesign },
          ]
        : [];

  const currentDisplayCode = userRole === "ADMIN" ? editableStyleCode : isNew ? "NEW_STYLE" : urlStyleCode;

  // 창이 좁아지면(또는 '모바일 화면 보기') 개편된 모바일 화면을 그대로 보여준다.
  // 모바일에서 실제로 쓰는 화면과 같은 컴포넌트(FeedList + EvaluationSheet)를 재사용하므로
  // PC 레이아웃을 세로로 늘어놓은 것이 아니라 진짜 모바일 UI가 나온다.
  if (!isDesktop && userRole !== "ADMIN" && !isNew && product) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-white/85 backdrop-blur-md">
          {/* 모바일 피드 헤더와 동일하게 뒤로가기 버튼만 — 품번·순번은 각 포스트 헤더가 이미 표시한다 */}
          <div className="flex h-12 items-center px-3">
            <button onClick={exitToGallery} aria-label="갤러리로 돌아가기" className="-ml-1 p-1">
              <ChevronLeft className="h-6 w-6" />
            </button>
          </div>
        </header>
        <FeedList products={products} startIndex={idx} onOpenSheet={setSheetTarget} />
        <EvaluationSheet
          product={sheetTarget}
          open={!!sheetTarget}
          onOpenChange={(open) => !open && setSheetTarget(null)}
        />
      </div>
    );
  }

  return (
    <div className={`flex min-h-[100dvh] flex-col bg-white${userRole !== "ADMIN" ? " lg:h-[100dvh]" : ""}`}>
      <div className="sticky top-0 z-20 shrink-0 bg-background px-4 py-3 border-b">
        <div className="relative flex h-6 w-full items-center justify-between">
          {/* 뒤로 가기 = 갤러리로 나가기. 미저장분을 먼저 반영한다.
              (브라우저 히스토리 back은 스타일→스타일 이동 시 직전 스타일로 가버려서 쓰지 않는다) */}
          <button onClick={exitToGallery} className="flex items-center text-foreground" aria-label="갤러리로 나가기">
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
            {userRole === "ADMIN" ? (
              <input
                type="text"
                value={editableStyleCode}
                onChange={(e) => setEditableStyleCode(normalizeStyleNo(e.target.value))}
                className="w-32 border border-foreground bg-background px-2 py-0.5 text-center text-base font-medium uppercase"
                placeholder="품번 입력"
              />
            ) : (
              /* 이 화면의 주인공 — PC에서는 카운터보다 확실히 커야 한다 */
              <span className="text-base font-medium lg:text-xl lg:font-semibold lg:tracking-tight">{currentDisplayCode}</span>
            )}
          </div>
          <div className="text-base font-medium text-muted-foreground lg:text-[13px] lg:font-normal tabular-nums">
            {isNew ? "NEW" : `${idx + 1} / ${products.length}`}
          </div>
        </div>
      </div>

      {isPcReviewer ? (
        /* 캔버스를 오프화이트로 깔아 흰 상품사진이 '사진'으로 읽히게 한다.
           폭을 억지로 채우지 않고 사진+패널을 한 덩어리로 가운데 정렬한다 */
        <div
          ref={photoAreaRef}
          className="flex min-h-0 w-full flex-1 items-start justify-center gap-7 bg-muted px-6 py-5"
        >
          {!hasNoImages && (currentImages.length > 0 || currentCoordImages.length > 0) && (
            <div
              className="flex min-w-0 items-stretch justify-center gap-5"
              style={photoBox.h ? { height: photoBox.h + (stripReserved ? STRIP_BLOCK : 0) } : undefined}
            >
              {currentImages.length > 0 && (
              <ImagePane
                images={currentImages}
                label="단품"
                frameWidth={productPaneWidth}
                frameHeight={productPaneHeight}
                reserveStrip={stripReserved}
                styleCode={urlStyleCode ?? ""}
                activeIndex={paneIndex.product}
                onIndexChange={(i) => setPaneIndex((p) => ({ ...p, product: i }))}
                likedUrls={likedUrls}
                onToggleLike={toggleLike}
                onOpenLightbox={setLightboxSrc}
                isActive={activePane === "product"}
                onActivate={() => setActivePane("product")}
              />
              )}
              {currentCoordImages.length > 0 && (
              <ImagePane
                images={currentCoordImages}
                label="코디"
                frameWidth={coordPaneWidth}
                frameHeight={coordPaneHeight}
                reserveStrip={stripReserved}
                styleCode={urlStyleCode ?? ""}
                activeIndex={paneIndex.coord}
                onIndexChange={(i) => setPaneIndex((p) => ({ ...p, coord: i }))}
                likedUrls={likedUrls}
                onToggleLike={toggleLike}
                onOpenLightbox={setLightboxSrc}
                isActive={activePane === "coord"}
                onActivate={() => setActivePane("coord")}
              />
              )}
            </div>
          )}

          {/* 우측 고정 패널. 임직원1은 상세정보(원가)까지 들어가야 해서 더 넓다.
              하단 여백은 썸네일 스트립 높이만큼 — 이전/다음 버튼이 사진 아랫변에 맞춰진다 */}
          <aside
            className="flex shrink-0 flex-col self-stretch"
            style={{ width: panelWidth, ...(photoBox.h ? { height: photoBox.h } : {}) }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              {typeof summaryTable === "function" ? summaryTable(true, dbProduct) : summaryTable}
              {detailTable}
              {evalRows.length > 0 && (
                <div className={`p-4 ${PC_PANEL}`}>
                  <h3 className="mb-3 text-[15px] font-semibold">의견을 남겨주세요.</h3>
                  <div className="space-y-3">
                    {evalRows.map((row) => (
                      <EvalRow
                        key={row.label}
                        label={row.label}
                        options={row.options}
                        selected={row.selected}
                        onSelect={row.onSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
              <CommentBox
                value={comment}
                onChange={setComment}
                className="w-full rounded-[10px] border border-black/[0.06] bg-card p-3 text-sm resize-none min-h-[7.5rem] max-h-[40vh] overflow-y-auto placeholder:text-muted-foreground"
              />
            </div>

            {/* 이동: 주행동(다음)만 채우고 이전은 낮춘다 */}
            <div className="shrink-0 pt-3">
              <div className="mb-1 h-4 text-right text-xs text-muted-foreground" aria-live="polite">
                {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 실패" : ""}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => goToStyle(-1)}
                  disabled={idx <= 0}
                  className="flex-1 rounded-lg border border-black/[0.12] py-3 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.04] disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  &lt; 이전 스타일
                </button>
                <button
                  onClick={() => goToStyle(1)}
                  className="flex-[1.4] rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  다음 스타일 &gt;
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
      <>
      {/* 모바일·ADMIN: 기존 세로 배치 (단품+코디를 합친 단일 슬라이더) */}
      <div className={userRole === "ADMIN" ? "" : "lg:flex lg:flex-1 lg:min-h-0 lg:w-full lg:items-stretch lg:gap-6 lg:px-4 lg:py-4"}>
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
        /* 이미지가 있을 때만 이미지 슬라이더 영역 표시 (없으면 숨김으로 상품정보/코멘트 영역이 위로 올라옴) */
        !hasNoImages && (
          /* 이미지 컬럼: 모바일은 기존 세로 스택, PC는 폭을 화면폭에서 산출(높이 종속 해제) + 하단 썸네일 스트립 */
          <div
            ref={imageAreaRef}
            className="px-4 pt-4 bg-white lg:shrink-0 lg:h-full lg:px-0 lg:pt-0 lg:flex lg:flex-col lg:w-[clamp(320px,34vw,560px)]"
          >
            <div className="relative w-full aspect-[2/3] shrink-0 overflow-hidden rounded-lg lg:aspect-auto lg:flex-1 lg:min-h-0 lg:w-full">
              <div
                ref={scrollRef}
                onScroll={() => {
                  if (scrollRef.current)
                    setActiveImage(Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth));
                }}
                className="flex h-full snap-x snap-mandatory overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
              >
                {sliderImages.map((src, i) => (
                  <div key={i} className="relative w-full shrink-0 snap-center rounded-lg overflow-hidden bg-white aspect-[2/3] lg:aspect-auto lg:h-full">
                    {/* 현재±1만 실제 로드 (25장 스타일에서 동시 다운로드 방지).
                        ResilientImage: 로드 실패 시 자동 재시도 + 여백을 사진 배경색으로 채움 */}
                    {Math.abs(i - activeImage) <= 1 ? (
                      <ResilientImage
                        src={src}
                        alt={`${urlStyleCode} 이미지 ${i + 1}`}
                        className="object-contain cursor-zoom-in"
                        edgeFill
                        onClick={() => setLightboxSrc(src)}
                      />
                    ) : (
                      <div className="h-full w-full bg-white" />
                    )}
                  </div>
                ))}
              </div>
              {/* 도트: 모바일 전용 (PC는 하단 썸네일 스트립으로 대체) */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 lg:hidden">
                {sliderImages.map((_, i) => (
                  <div key={i} className={`h-1.5 w-1.5 rounded-full ${i === activeImage ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
              {/* 좋아요 팝: 중앙 빨간 하트 → 하트 버튼으로 흡수 (모바일 피드와 동일 모션) */}
              {showHeartPop && (
                <span
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                  style={{ ["--fly-x" as any]: `${flyOffset.x}px`, ["--fly-y" as any]: `${flyOffset.y}px` }}
                >
                  <Heart className="h-24 w-24 fill-red-500 text-red-500 drop-shadow-lg animate-heart-pop" />
                </span>
              )}
              {/* 이미지 순번 표시: 현재/전체 */}
              {sliderImages.length > 0 && (
                <div className="absolute right-2 top-2 rounded-full bg-foreground/60 px-2.5 py-1 text-xs font-medium text-background">
                  {Math.min(activeImage, sliderImages.length - 1) + 1}/{sliderImages.length}
                </div>
              )}
              {/* 좋아요 버튼: 현재 이미지에 하트 (크게보기 위) — Liked_images로 평가에 기록 */}
              {sliderImages.length > 0 && userRole !== "ADMIN" && (
                <button
                  key={urlStyleCode}
                  ref={heartBtnRef}
                  onClick={toggleCurrentLike}
                  className="absolute bottom-11 right-2 flex h-9 w-9 animate-heart-in items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                  aria-label="이미지 좋아요"
                  aria-pressed={!!currentSliderUrl && likedUrls.has(currentSliderUrl)}
                >
                  <Heart
                    className={`h-5 w-5 transition-transform active:scale-90 ${currentSliderUrl && likedUrls.has(currentSliderUrl) ? "fill-red-500 text-red-500" : "text-foreground"}`}
                    strokeWidth={1.5}
                  />
                </button>
              )}
              {/* 크게보기 버튼: 현재 이미지를 확대 팝업으로 */}
              {sliderImages.length > 0 && (
                <button
                  onClick={() => setLightboxSrc(sliderImages[Math.min(activeImage, sliderImages.length - 1)])}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-foreground/60 px-2.5 py-1 text-xs font-medium text-background"
                  aria-label="이미지 크게보기"
                >
                  <Expand className="h-3.5 w-3.5" />
                  크게보기
                </button>
              )}
              {/* PC 전용 좌우 화살표 (모바일은 스와이프 유지) */}
              {sliderImages.length > 1 && (
                <>
                  <button
                    onClick={() => scrollToImage(activeImage - 1)}
                    disabled={activeImage <= 0}
                    className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md disabled:opacity-30"
                    aria-label="이전 이미지"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => scrollToImage(activeImage + 1)}
                    disabled={activeImage >= sliderImages.length - 1}
                    className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md disabled:opacity-30"
                    aria-label="다음 이미지"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {/* PC 전용 하단 썸네일 스트립 (모바일은 도트 유지) */}
            <div className="hidden lg:block lg:shrink-0 lg:pt-3">
              <ImageThumbStrip
                images={sliderImages}
                activeIndex={activeImage}
                onSelect={scrollToImage}
                likedUrls={likedUrls}
              />
            </div>
          </div>
        )
      )}

      <div
        className={`bg-background px-4 pt-4 pb-10${
          userRole !== "ADMIN"
            ? " lg:flex-1 lg:min-w-0 lg:px-0 lg:pt-0 lg:pb-0 lg:flex lg:flex-col lg:min-h-0"
            : ""
        }`}
      >
        {userRole !== "ADMIN" ? (
          <>
            {/* PC(lg): 세로 가운데 정렬 영역 (콘텐츠가 화면보다 길면 내부 스크롤) */}
            <div className="lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
              <div className="lg:w-full lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
                <div className={`lg:grid lg:grid-cols-2 lg:gap-4${userRole === "STAFF_1" ? " lg:flex-1 lg:min-h-0" : ""}`}>
                  <div className="lg:min-w-0 lg:flex lg:flex-col">
                    {typeof summaryTable === "function" ? summaryTable(true, dbProduct) : summaryTable}
                    {detailTable}
                  </div>
                  {evalRows.length > 0 && (
                    <div className={`p-3 mt-4 lg:mt-0 lg:flex-1 lg:min-w-0 rounded-md border border-foreground ${PC_PANEL} lg:p-4`}>
                      <h3 className="mb-3 text-sm font-bold lg:text-base">의견을 남겨주세요.</h3>
                      <div className="space-y-3">
                        {evalRows.map((row) => (
                          <EvalRow
                            key={row.label}
                            label={row.label}
                            options={row.options}
                            selected={row.selected}
                            onSelect={row.onSelect}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 총평(임직원1): 좌측 기본+상세 스택 옆 열에 배치 */}
                  {userRole === "STAFF_1" && (
                    <CommentBox
                      value={comment}
                      onChange={setComment}
                      className="w-full h-20 border rounded-lg p-3 text-sm resize-none mt-4 lg:mt-0 lg:min-w-0 lg:h-auto lg:min-h-[7rem] lg:max-h-[40vh] lg:overflow-y-auto"
                    />
                  )}
                </div>
                {/* 총평(임직원2/매장): [기본정보|평가] 행 아래에 두 영역을 합친 너비로 배치 */}
                {userRole !== "STAFF_1" && (
                  <CommentBox
                    value={comment}
                    onChange={setComment}
                    className="w-full h-20 border rounded-lg p-3 text-sm resize-none mt-4 lg:h-auto lg:min-h-[7rem] lg:max-h-[40vh] lg:overflow-y-auto"
                  />
                )}
              </div>
            </div>
            {/* 하단 버튼: 이동 전 미저장분 flush. 자동저장 상태는 조용한 텍스트로만 표시(성공 토스트 없음) */}
            <div className="flex items-center gap-2 pt-2 mt-4">
              <button
                onClick={() => goToStyle(-1)}
                disabled={idx <= 0}
                className="flex-1 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-30"
              >
                &lt; 이전 스타일
              </button>
              <span
                aria-live="polite"
                className="hidden lg:block w-24 shrink-0 text-center text-xs text-muted-foreground tabular-nums"
              >
                {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 실패" : ""}
              </span>
              <button
                onClick={() => goToStyle(1)}
                className="flex-1 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground"
              >
                다음 스타일 &gt;
              </button>
            </div>
          </>
        ) : (
          <>
            {typeof summaryTable === "function" ? summaryTable(true, dbProduct) : summaryTable}
            <div className="mt-4 flex gap-2">
              <button
                onClick={saveAdminProduct}
                className="flex-1 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground"
              >
                스타일 등록
              </button>
            </div>
          </>
        )}
      </div>
      </div>
      </>
      )}

      {/* 이미지 확대 팝업 */}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
};

export default ProductDetailShell;
