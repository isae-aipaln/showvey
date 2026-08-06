import React, { useState, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { db, storage } from "@/firebase";
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, writeBatch, orderBy } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { uploadProductImage, compressionOptionsFor } from "@/lib/uploadProductImage";
import { Plus, Trash2, Save, Upload, Download, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, ChevronLeft, ArrowDownUp } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import ProductImageCell from "@/components/admin/ProductImageCell";
import { CARD, CHECKBOX } from "@/components/admin/adminTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { normalizeStyleNo } from "@/lib/utils";

// CSV 헤더 매칭 정보
const CSV_MAPPING: Record<string, keyof ProductRow> = {
  품번: "styleNo",
  Style_no: "styleNo",
  표시번호: "displayNo",
  Display_no: "displayNo",
  썸네일: "thumbnail",
  Thumbnail_url: "thumbnail",
  단품이미지: "productImages",
  Product_image_urls: "productImages",
  코디이미지: "coordiImages",
  Coord_image_urls: "coordiImages",
  판매가: "price",
  Sale_price: "price",
  원단명: "fabricName",
  Fabric_name: "fabricName",
  혼용률: "composition",
  Composition: "composition",
  원단폭: "fabricWidth",
  Fabric_width: "fabricWidth",
  단가: "unitPrice",
  Unit_cost: "unitPrice",
  "M/U": "mu",
  Markup: "mu",
  요척: "consumption",
  Consumption: "consumption",
  원자재: "rawMaterial",
  Raw_material_cost: "rawMaterial",
  부자재: "subsidiary",
  Sub_material_cost: "subsidiary",
  특수부자재: "specialSubsidiary",
  Special_trim_cost: "specialSubsidiary",
  공임비: "laborCost",
  Labor_cost: "laborCost",
  제조원가: "cogs",
  Mfg_cost: "cogs",
  "추가 공임 정보": "addLaborInfo",
  추가공임정보: "addLaborInfo",
  Add_labor_info: "addLaborInfo",
  기타원자재정보: "otherMaterialInfo",
  Etc_rawmat_info: "otherMaterialInfo",
  "MINI/DELI_재고/선발주": "miniDeliStock",
  MINI_DELI_Stock_preorder: "miniDeliStock",
  상품설명: "productDesc",
  Product_desc: "productDesc",
};

interface ColumnDef {
  key: keyof ProductRow;
  label: string;
  type?: "image" | "text";
  limit?: number;
  /** 컬럼 폭(px) — colgroup과 테이블 최소폭 계산의 단일 소스 */
  width: number;
}

interface ProductRow {
  id: string;
  selected: boolean;
  styleNo: string;
  displayNo: string;
  thumbnail: string[];
  productImages: string[];
  coordiImages: string[];
  thumbnailFile?: File | null;
  productImageFiles?: File[];
  coordiImageFiles?: File[];
  price: string;
  fabricName: string;
  composition: string;
  fabricWidth: string;
  unitPrice: string;
  mu: string;
  consumption: string;
  rawMaterial: string;
  subsidiary: string;
  specialSubsidiary: string;
  laborCost: string;
  cogs: string;
  addLaborInfo: string;
  otherMaterialInfo: string;
  miniDeliStock: string;
  productDesc: string;   // 상품설명 — 관리자 테이블에는 비노출(성능), 데이터만 유지
}

const emptyRow = (): ProductRow => ({
  id: Math.random().toString(36).substr(2, 9),
  selected: false,
  styleNo: "",
  displayNo: "",
  thumbnail: [],
  productImages: [],
  coordiImages: [],
  thumbnailFile: null,
  productImageFiles: [],
  coordiImageFiles: [],
  price: "",
  fabricName: "",
  composition: "",
  fabricWidth: "",
  unitPrice: "",
  mu: "",
  consumption: "",
  rawMaterial: "",
  subsidiary: "",
  specialSubsidiary: "",
  laborCost: "",
  cogs: "",
  addLaborInfo: "",
  otherMaterialInfo: "",
  miniDeliStock: "",
  productDesc: "",
});

const COLUMNS: ColumnDef[] = [
  { key: "styleNo", label: "품번", width: 150 },
  { key: "displayNo", label: "순번", width: 90 },
  { key: "thumbnail", label: "썸네일 (1)", type: "image", limit: 1, width: 100 },
  { key: "productImages", label: "단품이미지 (15)", type: "image", limit: 15, width: 268 },
  // 코디이미지 컬럼 복원 (2026-07-30 — 모바일 피드에서 코디이미지에만 좋아요를 띄우기 위해 카테고리 분리 재개)
  { key: "coordiImages", label: "코디이미지 (10)", type: "image", limit: 10, width: 268 },
  { key: "price", label: "판매가", width: 110 },
  { key: "fabricName", label: "원단명", width: 160 },
  { key: "composition", label: "혼용률", width: 200 },
  { key: "fabricWidth", label: "원단폭", width: 100 },
  { key: "unitPrice", label: "단가", width: 100 },
  { key: "mu", label: "M/U", width: 90 },
  { key: "consumption", label: "요척", width: 90 },
  { key: "rawMaterial", label: "원자재", width: 130 },
  { key: "subsidiary", label: "부자재", width: 130 },
  { key: "specialSubsidiary", label: "특수부자재", width: 130 },
  { key: "laborCost", label: "공임비", width: 110 },
  { key: "cogs", label: "제조원가", width: 110 },
  { key: "addLaborInfo", label: "추가공임정보", width: 160 },
  { key: "otherMaterialInfo", label: "기타원자재정보", width: 160 },
  { key: "miniDeliStock", label: "MINI/DELI_재고/선발주", width: 190 },
];

/** 좌측 고정 열(체크박스+순서이동) 폭 — colgroup 폭과 품번 열 sticky offset의 단일 소스 */
const SELECT_COL_W = 84;

/** "3-1", "46-2" 같은 복합 순번을 숫자 기준으로 비교 (빈 값은 맨 뒤) */
const displayNoSortKey = (value: string): [number, number] => {
  const m = String(value ?? "").trim().match(/^(\d+)(?:\s*-\s*(\d+))?/);
  if (!m) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  return [parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0];
};
/** 테이블 최소 폭 — 컬럼 정의에서 자동 계산 (기존 3500px 하드코딩 2곳을 대체) */
const TABLE_MIN_WIDTH = SELECT_COL_W + COLUMNS.reduce((sum, c) => sum + c.width, 0);

const AdminEvaluationDetailPage = () => {
  const { id } = useParams();
  const { refreshData } = useAppContext();
  const navigate = useNavigate();

  const [evaluationName, setEvaluationName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isOngoing, setIsOngoing] = useState(false);
  const [isRandomized, setIsRandomized] = useState(false);
  const [rows, setRows] = useState<ProductRow[]>([emptyRow()]);
  const [initialStyleNos, setInitialStyleNos] = useState<string[]>([]);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [activeUpload, setActiveUpload] = useState<{ rowId: string; type: any; limit: number } | null>(null);
  // 이미지 드래그 정렬: 드래그 중인 이미지 (행/컬럼/인덱스)
  const [dragInfo, setDragInfo] = useState<{ rowId: string; type: string; index: number } | null>(null);

  const calculateAutoStatus = (start: string, end: string) => {
    if (!start || !end) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(start.replace(/-/g, "/"));
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end.replace(/-/g, "/"));
    endDate.setHours(23, 59, 59, 999);
    return now >= startDate && now <= endDate;
  };

  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableContainer = tableContainerRef.current;
    if (!topScroll || !tableContainer) return;

    const handleTopScroll = () => {
      if (Math.abs(tableContainer.scrollLeft - topScroll.scrollLeft) > 1) {
        tableContainer.scrollLeft = topScroll.scrollLeft;
      }
    };
    const handleTableScroll = () => {
      if (Math.abs(topScroll.scrollLeft - tableContainer.scrollLeft) > 1) {
        topScroll.scrollLeft = tableContainer.scrollLeft;
      }
    };

    topScroll.addEventListener("scroll", handleTopScroll);
    tableContainer.addEventListener("scroll", handleTableScroll);

    return () => {
      topScroll.removeEventListener("scroll", handleTopScroll);
      tableContainer.removeEventListener("scroll", handleTableScroll);
    };
  }, [rows]);

  useEffect(() => {
    if (startDate && endDate) {
      const isPeriodActive = calculateAutoStatus(startDate, endDate);
      setIsOngoing(isPeriodActive);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (id && id !== "new") {
      fetchEvaluationDetail();
    }
  }, [id]);

  const fetchEvaluationDetail = async () => {
    const loadingToast = toast.loading("데이터를 불러오는 중입니다...");
    try {
      const projectRef = doc(db, "projects", id!);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        setEvaluationName(projectSnap.id);

        const periodParts = projectData.Period ? projectData.Period.split(" ~ ") : ["", ""];
        const sDate = periodParts[0] ? periodParts[0].replace(/\./g, "-") : "";
        const eDate = periodParts[1] ? periodParts[1].replace(/\./g, "-") : "";

        setStartDate(sDate);
        setEndDate(eDate);
        setIsRandomized(projectData.Arrangement === "랜덤배열");
        setIsOngoing(projectData.Status);
      }

      const productsRef = collection(db, "products");
      const q = query(productsRef, where("Project_name", "==", id), orderBy("sort_order", "asc"));
      const productSnapshot = await getDocs(q);

      if (!productSnapshot.empty) {
        const styleNos = productSnapshot.docs.map(doc => doc.id);
        setInitialStyleNos(styleNos);
        const formattedRows: ProductRow[] = productSnapshot.docs.map((doc) => {
          const item = doc.data();
          return {
            id: Math.random().toString(36).substr(2, 9),
            selected: false,
            styleNo: doc.id || "",
            displayNo: item.Display_no?.toString() || "",
            thumbnail: item.Thumbnail_url ? [item.Thumbnail_url] : [],
            productImages: item.Product_image_urls || [],
            coordiImages: item.Coord_image_urls || [],
            productDesc: item.Product_desc || "",
            thumbnailFile: null,
            productImageFiles: [],
            coordiImageFiles: [],
            price: item.Sale_price?.toString() || "",
            fabricName: item.Fabric_name || "",
            composition: item.Composition || "",
            fabricWidth: item.Fabric_width || "",
            unitPrice: item.Unit_cost?.toString() || "",
            mu: item.Markup?.toString() || "",
            consumption: item.Consumption?.toString() || "",
            rawMaterial: item.Raw_material_cost?.toString() || "",
            subsidiary: item.Sub_material_cost?.toString() || "",
            specialSubsidiary: item.Special_trim_cost?.toString() || "",
            laborCost: item.Labor_cost?.toString() || "",
            cogs: item.Mfg_cost?.toString() || "",
            addLaborInfo: item.Add_labor_info || "",
            otherMaterialInfo: item.Etc_rawmat_info || "",
            miniDeliStock: item.MINI_DELI_Stock_preorder || "",
          };
        });
        setRows(formattedRows);
      } else {
        setRows([emptyRow()]);
        setInitialStyleNos([]);
      }
      toast.dismiss(loadingToast);
    } catch (err: any) {
      console.error("데이터 불러오기 에러:", err.message);
      toast.dismiss(loadingToast);
      toast.error("데이터를 불러오는데 실패했습니다.");
    }
  };

  const uploadToFirebase = (file: File, styleNo: string, category: string) =>
    uploadProductImage(file, styleNo, category);

  const handleDeleteImage = async (
    rowIndex: number,
    type: "thumbnail" | "product" | "coordi",
    imageIndex: number,
    imageUrlOrFile: string | File,
  ) => {
    const isEditMode = id && id !== "new";
    const isSavedUrl = typeof imageUrlOrFile === "string" && imageUrlOrFile.startsWith("http");
    let loadingToastId: string | number | null = null;

    try {
      if (isEditMode && isSavedUrl) {
        loadingToastId = toast.loading("스토리지에서 이미지를 영구 삭제 중입니다...");
        const decodedUrl = decodeURIComponent(imageUrlOrFile as string);
        const pathPart = decodedUrl.split("/o/")[1]?.split("?")[0];
        if (pathPart) {
          const imageRef = ref(storage, pathPart);
          await deleteObject(imageRef);
        }
      }

      setRows((prevRows) => {
        const updatedRows = [...prevRows];
        const targetRow = updatedRows[rowIndex];
        if (type === "thumbnail") {
          targetRow.thumbnail = [];
          targetRow.thumbnailFile = null;
        } else if (type === "product") {
          if (typeof imageUrlOrFile === "string") {
            targetRow.productImages = targetRow.productImages.filter((_, i) => i !== imageIndex);
          } else {
            targetRow.productImageFiles = targetRow.productImageFiles?.filter((f) => f !== imageUrlOrFile);
          }
        } else if (type === "coordi") {
          if (typeof imageUrlOrFile === "string") {
            targetRow.coordiImages = targetRow.coordiImages.filter((_, i) => i !== imageIndex);
          } else {
            targetRow.coordiImageFiles = targetRow.coordiImageFiles?.filter((f) => f !== imageUrlOrFile);
          }
        }
        return updatedRows;
      });

      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        toast.success("스토리지 파일이 삭제되었습니다.");
      } else {
        toast.success("목록에서 삭제되었습니다.");
      }
    } catch (error: any) {
      if (loadingToastId) toast.dismiss(loadingToastId);
      toast.error(`이미지 삭제 실패: ${error.message}`);
    }
  };

  const handleTemplateDownload = async () => {
    // \uC0C1\uD488\uC815\uBCF4 \uC5C5\uB85C\uB4DC \uC591\uC2DD(xlsx) \u2014 \uCEEC\uB7FC \uC21C\uC11C/\uBA85\uCE6D\uC740 \uC0C1\uD488\uC815\uBCF4_\uC5C5\uB85C\uB4DC_\uC591\uC2DD.xlsx \uAE30\uC900
    const headers = [
      "sort_order", "Style_no", "Display_no", "Thumbnail_url", "Product_image_urls", "Sale_price",
      "Fabric_name", "Composition", "Fabric_width", "Unit_cost", "Markup", "Consumption",
      "Raw_material_cost", "Sub_material_cost", "Special_trim_cost", "Labor_cost", "Mfg_cost",
      "Add_labor_info", "Etc_rawmat_info", "MINI_DELI_Stock_preorder", "Product_desc",
    ];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 2) }));
    sheet.getRow(1).font = { bold: true };
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "상품정보_업로드_양식.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!evaluationName.trim() || !startDate || !endDate) return toast.error("내용을 입력해주세요.");
    const loadingToast = toast.loading("저장 중입니다...");
    const parseNum = (val: string) => {
      if (!val || val.trim() === "") return null;
      const num = Number(val.replace(/,/g, ""));
      return isNaN(num) ? null : num;
    };

    try {
      const uploadTasks: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.styleNo) continue;
        const normalized = normalizeStyleNo(row.styleNo);
        if (row.thumbnailFile) uploadTasks.push({ rowIndex: i, type: 'thumbnail', file: row.thumbnailFile, styleNo: normalized });
        if (row.productImageFiles) row.productImageFiles.forEach(f => uploadTasks.push({ rowIndex: i, type: 'product', file: f, styleNo: normalized }));
        if (row.coordiImageFiles) row.coordiImageFiles.forEach(f => uploadTasks.push({ rowIndex: i, type: 'coordi', file: f, styleNo: normalized }));
      }

      const uploadResults: Map<number, any> = new Map();
      rows.forEach((_, i) => uploadResults.set(i, { products: [], coordis: [] }));

      if (uploadTasks.length > 0) {
        const CHUNK_SIZE = 5;
        for (let i = 0; i < uploadTasks.length; i += CHUNK_SIZE) {
          const chunk = uploadTasks.slice(i, i + CHUNK_SIZE);
          const chunkResults = await Promise.all(chunk.map(async (t) => {
            const url = await uploadToFirebase(t.file, t.styleNo, t.type);
            return { ...t, url };
          }));
          chunkResults.forEach(r => {
            const entry = uploadResults.get(r.rowIndex);
            if (r.type === 'thumbnail') entry.thumbnail = r.url;
            else if (r.type === 'product') entry.products.push(r.url);
            else entry.coordis.push(r.url);
          });
        }
      }

      const batch = writeBatch(db);

      const currentStyleNos = new Set(rows.map(r => normalizeStyleNo(r.styleNo)).filter(Boolean));
      const deletedStyleNos = initialStyleNos.filter(ns => !currentStyleNos.has(ns));
      deletedStyleNos.forEach(styleNo => {
        batch.delete(doc(db, "products", styleNo));
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.styleNo) continue;
        const normalized = normalizeStyleNo(row.styleNo);
        const res = uploadResults.get(i);
        const item = {
          Style_no: normalized,
          Display_no: row.displayNo || "",
          Project_name: evaluationName,
          Thumbnail_url: res.thumbnail || row.thumbnail[0] || "",
          Product_image_urls: [...row.productImages.filter(u => u.startsWith("http")), ...res.products],
          Coord_image_urls: [...row.coordiImages.filter(u => u.startsWith("http")), ...res.coordis],
          Sale_price: parseNum(row.price),
          Fabric_name: row.fabricName,
          Composition: row.composition,
          Fabric_width: row.fabricWidth,
          Unit_cost: parseNum(row.unitPrice),
          Markup: parseNum(row.mu),
          Consumption: parseNum(row.consumption),
          Raw_material_cost: parseNum(row.rawMaterial),
          Sub_material_cost: parseNum(row.subsidiary),
          Special_trim_cost: parseNum(row.specialSubsidiary),
          Labor_cost: parseNum(row.laborCost),
          Mfg_cost: parseNum(row.cogs),
          Add_labor_info: row.addLaborInfo,
          Etc_rawmat_info: row.otherMaterialInfo,
          MINI_DELI_Stock_preorder: row.miniDeliStock,
          Product_desc: row.productDesc || "",
          sort_order: i,
        };
        batch.set(doc(db, "products", normalized), item, { merge: true });
      }

      const formatDate = (d: string) => d.replace(/-/g, ".");
      await setDoc(doc(db, "projects", evaluationName), {
        Project_name: evaluationName,
        Period: `${formatDate(startDate)} ~ ${formatDate(endDate)}`,
        Total_style: rows.length,
        Status: isOngoing,
        Arrangement: isRandomized ? "랜덤배열" : "정배열",
      }, { merge: true });

      await batch.commit();
      setInitialStyleNos(Array.from(currentStyleNos));
      toast.dismiss(loadingToast);
      toast.success("저장 완료!");
      await refreshData();
      navigate("/admin/evaluations");
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(`저장 실패: ${err.message}`);
    }
  };

  const parseCSV = (text: string) => {
    const result: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"' && inQuotes && nextChar === '"') { field += '"'; i++; }
      else if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) { row.push(field.trim()); field = ""; }
      else if ((char === "\r" || char === "\n") && !inQuotes) {
        if (field || row.length > 0) { row.push(field.trim()); result.push(row); field = ""; row = []; }
        if (char === "\r" && nextChar === "\n") i++;
      } else field += char;
    }
    if (field || row.length > 0) { row.push(field.trim()); result.push(row); }
    return result;
  };

  // xlsx 셀 값을 문자열로 변환 (하이퍼링크/수식/리치텍스트/날짜 셀 대응)
  const cellToString = (v: any): string => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object") {
      if ((v as any).richText) return (v as any).richText.map((t: any) => t.text).join("").trim();
      if ((v as any).text !== undefined) return String((v as any).text).trim();
      if ((v as any).result !== undefined) return cellToString((v as any).result);
      return String(v).trim();
    }
    return String(v).trim();
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        let allData: string[][];
        if (isXlsx) {
          // 엑셀 양식(.xlsx) 파싱 — 첫 번째 시트 사용, 이후 처리(CSV_MAPPING)는 CSV와 공통
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          const ws = workbook.worksheets[0];
          if (!ws) return toast.error("엑셀 시트를 찾을 수 없습니다.");
          const parsed: string[][] = [];
          ws.eachRow({ includeEmpty: false }, (row) => {
            const vals: string[] = [];
            for (let c = 1; c <= ws.columnCount; c++) vals.push(cellToString(row.getCell(c).value));
            parsed.push(vals);
          });
          // 서식만 있고 값이 없는 유령 행 제거 (헤더 행은 유지)
          allData = parsed.filter((r, i) => i === 0 || r.some((v) => v !== ""));
        } else {
          let text = "";
          try {
            const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
            text = utf8Decoder.decode(buffer);
          } catch {
            const eucKrDecoder = new TextDecoder("euc-kr");
            text = eucKrDecoder.decode(buffer);
          }
          allData = parseCSV(text);
        }
        if (allData.length < 2) return toast.error("데이터가 없습니다.");
        const headers = allData[0];
        const existingMap = new Map<string, any>();
        rows.forEach(r => { if (r.styleNo) existingMap.set(r.styleNo.toUpperCase(), r); });

        const newRows = allData.slice(1).map(values => {
          const rowData = emptyRow();
          headers.forEach((h, i) => {
            const key = CSV_MAPPING[h];
            if (key) {
              const val = values[i] || "";
              if (["thumbnail", "productImages", "coordiImages"].includes(key)) {
                (rowData as any)[key] = val ? val.split(/[|,]/).map((v: string) => v.trim()) : [];
              } else if (key === "styleNo") {
                rowData.styleNo = normalizeStyleNo(val);
              } else {
                (rowData as any)[key] = val;
              }
            }
          });
          if (rowData.styleNo) {
            const ex = existingMap.get(rowData.styleNo.toUpperCase());
            if (ex) {
              if (rowData.thumbnail.length === 0) rowData.thumbnail = ex.thumbnail;
              if (rowData.productImages.length === 0) rowData.productImages = ex.productImages;
              if (rowData.coordiImages.length === 0) rowData.coordiImages = ex.coordiImages;
              // 엑셀에 상품설명 컬럼이 없거나 비어있으면 기존 설명 유지 (재업로드 시 유실 방지)
              if (!rowData.productDesc) rowData.productDesc = ex.productDesc || "";
              rowData.thumbnailFile = ex.thumbnailFile;
              rowData.productImageFiles = ex.productImageFiles;
              rowData.coordiImageFiles = ex.coordiImageFiles;
            }
          }
          return rowData;
        });
        setRows(newRows);
        toast.success("상품 정보 로드 완료");
      } catch (err) {
        toast.error("파일 읽기 실패 — CSV 또는 XLSX 형식을 확인해주세요.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleZipImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const loadingToast = toast.loading("이미지 분석 중...");
    try {
      const zip = await JSZip.loadAsync(file);
      const imageFiles: any[] = [];
      Object.entries(zip.files).forEach(([path, obj]) => {
        if (!obj.dir && /\.(jpe?g|png|webp|gif)$/i.test(path)) imageFiles.push({ path, file: obj });
      });

      if (imageFiles.length === 0) { toast.dismiss(loadingToast); return toast.error("이미지가 없습니다."); }

      const tempRows = [...rows];
      const BATCH_SIZE = 5;
      for (let i = 0; i < imageFiles.length; i++) {
        const img = imageFiles[i];
        const parts = img.path.split("/");
        if (parts.length < 2) continue;
        const fileName = parts[parts.length - 1];
        const category = parts[parts.length - 2].toLowerCase();
        const styleNo = parts[parts.length - 3] || "";
        const normalizedZipStyleNo = normalizeStyleNo(styleNo);
        const rowIndex = tempRows.findIndex(r => r.styleNo && styleNo && normalizeStyleNo(r.styleNo) === normalizedZipStyleNo);

        if (rowIndex !== -1) {
          const blob = await img.file.async("blob");
          const original = new File([blob], fileName, { type: blob.type });
          let final = original;
          if (original.size > 0.5 * 1024 * 1024) {
            try {
              const comp = await imageCompression(original, compressionOptionsFor(category));
              final = new File([comp], fileName, { type: comp.type });
            } catch (err) {}
          }
          const url = URL.createObjectURL(final);
          const row = { ...tempRows[rowIndex] };
          if (category === "thumbnail") { row.thumbnail = [url]; row.thumbnailFile = final; }
          else if (category === "product" && row.productImages.length < 15) { row.productImages = [...row.productImages, url]; row.productImageFiles = [...(row.productImageFiles || []), final]; }
          else if (category === "coordi" && row.coordiImages.length < 10) { row.coordiImages = [...row.coordiImages, url]; row.coordiImageFiles = [...(row.coordiImageFiles || []), final]; }
          tempRows[rowIndex] = row;
        }

        if ((i + 1) % BATCH_SIZE === 0 || (i + 1) === imageFiles.length) {
          toast.loading(`이미지 매칭 중... (${i + 1}/${imageFiles.length})`, { id: loadingToast });
          await new Promise(r => setTimeout(r, 10));
        }
      }
      setRows(tempRows);
      toast.dismiss(loadingToast);
      toast.success("이미지 매칭 완료");
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("ZIP 처리 실패");
    }
  };

  const handleDropFiles = async (files: File[], rowId: string, type: any, limit: number) => {
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length === 0) return toast.error("이미지 파일만 가능합니다.");
    const compressed: File[] = [];
    for (const f of images) {
      try {
        const c = await imageCompression(f, compressionOptionsFor(type));
        compressed.push(new File([c], f.name, { type: c.type }));
      } catch { compressed.push(f); }
    }
    const urls = compressed.map(f => URL.createObjectURL(f));
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      if (type === "thumbnail") return { ...r, thumbnail: [urls[0]], thumbnailFile: compressed[0] };
      const current = type === "productImages" ? r.productImages : r.coordiImages;
      const allowed = compressed.slice(0, limit - current.length);
      const allowedUrls = urls.slice(0, limit - current.length);
      if (type === "productImages") return { ...r, productImages: [...r.productImages, ...allowedUrls], productImageFiles: [...(r.productImageFiles || []), ...allowed] };
      return { ...r, coordiImages: [...r.coordiImages, ...allowedUrls], coordiImageFiles: [...(r.coordiImageFiles || []), ...allowed] };
    }));
  };

  // 이미지 드래그 정렬: dragInfo의 이미지를 같은 행·같은 컬럼의 toIndex 위치로 이동.
  // 새로 추가된(blob) 이미지는 파일 목록과의 대응이 어긋나지 않도록 함께 재정렬한다.
  const handleReorderImage = (rowId: string, type: string, toIndex: number) => {
    if (!dragInfo || dragInfo.rowId !== rowId || dragInfo.type !== type) return;
    const from = dragInfo.index;
    setDragInfo(null);
    if (from === toIndex) return;
    const fileKey = type === "productImages" ? "productImageFiles" : type === "coordiImages" ? "coordiImageFiles" : null;
    if (!fileKey) return;   // 썸네일(1장)은 정렬 불필요
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const oldUrls = (r as any)[type] as string[];
      if (from >= oldUrls.length) return r;
      const newUrls = [...oldUrls];
      const [moved] = newUrls.splice(from, 1);
      newUrls.splice(Math.min(toIndex, newUrls.length), 0, moved);
      // blob URL ↔ File 대응 유지 (기존 blob 순서 = 파일 목록 순서)
      const files = ((r as any)[fileKey] as File[] | undefined) || [];
      const oldBlobs = oldUrls.filter(u => !u.startsWith("http"));
      const blobToFile = new Map(oldBlobs.map((u, i) => [u, files[i]]));
      const newFiles = newUrls.filter(u => !u.startsWith("http")).map(u => blobToFile.get(u)).filter(Boolean) as File[];
      return { ...r, [type]: newUrls, [fileKey]: newFiles };
    }));
  };

  // 단품 ↔ 코디 간 이미지 이동 (URL만 배열 간 이동 — Storage 파일은 그대로라 재업로드 불필요, 저장 시 반영)
  const handleMoveImage = (rowId: string, fromType: "productImages" | "coordiImages", index: number) => {
    const toType = fromType === "productImages" ? "coordiImages" : "productImages";
    const toLimit = COLUMNS.find(c => c.key === toType)?.limit ?? 15;
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const url = ((row as any)[fromType] as string[])[index];
    if (!url) return;
    if (!url.startsWith("http")) {
      toast.error("저장 전 새 이미지는 이동할 수 없습니다. 먼저 저장한 뒤 이동해주세요.");
      return;
    }
    if (((row as any)[toType] as string[]).length >= toLimit) {
      toast.error(`${toType === "coordiImages" ? "코디이미지" : "단품이미지"}가 이미 최대 ${toLimit}장입니다.`);
      return;
    }
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? {
            ...r,
            [fromType]: ((r as any)[fromType] as string[]).filter((_, i2) => i2 !== index),
            [toType]: [...((r as any)[toType] as string[]), url],
          }
        : r,
    ));
  };

  // ── 행 순서 변경 ─────────────────────────────────────────────
  // 행 드래그는 제외 (dragover마다 전체 행이 리렌더돼 165행에서 심하게 느려짐).
  // 대량 재배치는 순번 정렬, 소소한 조정은 이동 버튼으로 처리한다.

  /** from 위치의 행을 to 위치로 이동 (교환이 아니라 삽입) */
  const moveRow = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setRows(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(Math.min(to, next.length), 0, moved);
      return next;
    });
  };

  /** 순번(Display_no) 값 기준으로 전체 재정렬 — 엑셀에서 순번을 채워 올린 뒤 한 번에 반영 */
  const sortByDisplayNo = () => {
    const filled = rows.filter(r => String(r.displayNo ?? "").trim() !== "").length;
    if (filled === 0) {
      toast.error("순번이 입력된 행이 없습니다.");
      return;
    }
    setRows(prev =>
      [...prev].sort((a, b) => {
        const ka = displayNoSortKey(a.displayNo);
        const kb = displayNoSortKey(b.displayNo);
        return ka[0] - kb[0] || ka[1] - kb[1];
      }),
    );
    toast.success(`순번대로 정렬했습니다. (${filled}개) 저장을 눌러야 반영됩니다.`);
  };

  // 단품·코디 이미지를 썸네일로 지정 (URL만 복사 — 원본은 그대로 두어 피드의 [단품→코디] 순서 유지)
  const handleSetThumbnail = (rowId: string, fromType: "productImages" | "coordiImages", index: number) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const url = ((row as any)[fromType] as string[])[index];
    if (!url) return;
    if (!url.startsWith("http")) {
      toast.error("저장 전 새 이미지는 썸네일로 지정할 수 없습니다. 먼저 저장한 뒤 지정해주세요.");
      return;
    }
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, thumbnail: [url], thumbnailFile: null } : r)));
    toast.success("썸네일로 지정했습니다. 저장을 눌러야 반영됩니다.");
  };

  const renderImageCell = (row: ProductRow, type: any, limit: number) => {
    const images = (row as any)[type] as string[];
    const rowIndex = rows.findIndex(r => r.id === row.id);
    const deleteType = type === "productImages" ? "product" : type === "coordiImages" ? "coordi" : "thumbnail";
    const isThisCellDragging = dragInfo && dragInfo.rowId === row.id && dragInfo.type === type;

    return (
      <ProductImageCell
        images={images}
        type={type}
        limit={limit}
        draggingIndex={isThisCellDragging ? dragInfo!.index : null}
        isInternalDrag={!!isThisCellDragging}
        onDragStart={(i) => setDragInfo({ rowId: row.id, type, index: i })}
        onDragEnd={() => setDragInfo(null)}
        onReorder={(toIndex) => handleReorderImage(row.id, type, toIndex)}
        onDelete={(i, url) => handleDeleteImage(rowIndex, deleteType, i, url)}
        onMove={(i) => handleMoveImage(row.id, type, i)}
        onSetThumbnail={(i) => handleSetThumbnail(row.id, type, i)}
        thumbnailUrl={row.thumbnail[0]}
        onAddClick={() => { setActiveUpload({ rowId: row.id, type, limit }); fileInputRef.current?.click(); }}
        onDropFiles={(files) => handleDropFiles(files, row.id, type, limit)}
      />
    );
  };

  const selectedCount = rows.filter(r => r.selected).length;

  return (
    <AdminShell
      title="품평 상세"
      fill
      headerLeft={
        // 뒤로가기는 좌측 상단이 관례 (제목 앞)
        <button
          onClick={() => navigate("/admin/evaluations")}
          aria-label="목록으로"
          title="목록으로"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
      }
      headerRight={
        <>
          {/* 업로드·양식 다운로드는 페이지 전역 액션이므로 툴바에 배치 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Upload size={14} strokeWidth={1.5} /> 가져오기 / 내보내기
                <ChevronDown size={14} strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => csvInputRef.current?.click()}>
                <Upload size={14} strokeWidth={1.5} className="mr-2" /> 상품정보 업로드
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => zipInputRef.current?.click()}>
                <Upload size={14} strokeWidth={1.5} className="mr-2" /> 이미지 업로드 (ZIP)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleTemplateDownload}>
                <Download size={14} strokeWidth={1.5} className="mr-2" /> 양식 다운로드
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {/* 파일 input 3종은 드롭다운 밖(페이지 루트)에 유지 — 언마운트되면 ref.click()이 동작하지 않음 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async e => {
          if (!activeUpload || !e.target.files) return;
          const raw = Array.from(e.target.files);
          const compressed: File[] = [];
          for (const f of raw) {
            try {
              const c = await imageCompression(f, compressionOptionsFor(activeUpload.type));
              compressed.push(new File([c], f.name, { type: c.type }));
            } catch { compressed.push(f); }
          }
          const urls = compressed.map(f => URL.createObjectURL(f));
          setRows(rows.map(r => {
            if (r.id === activeUpload.rowId) {
              if (activeUpload.type === "thumbnail") return { ...r, thumbnail: [urls[0]], thumbnailFile: compressed[0] };
              if (activeUpload.type === "productImages") return { ...r, productImages: [...r.productImages, ...urls], productImageFiles: [...(r.productImageFiles || []), ...compressed] };
              if (activeUpload.type === "coordiImages") return { ...r, coordiImages: [...r.coordiImages, ...urls], coordiImageFiles: [...(r.coordiImageFiles || []), ...compressed] };
            }
            return r;
          }));
          setActiveUpload(null);
        }}
      />
      <input ref={csvInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleCsvUpload} />
      <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipImageUpload} />

      {/* 설정 카드 */}
      <div className={`${CARD} mb-4 shrink-0 p-4`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">품평 이름</span>
            <Input value={evaluationName} onChange={e => setEvaluationName(e.target.value)} placeholder="품평회 명칭 입력" className="h-9 w-52 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">기간</span>
            <div className="flex items-center gap-2">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-40 text-sm tabular-nums" />
              <span className="text-muted-foreground">~</span>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-40 text-sm tabular-nums" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">스타일 랜덤배열</span>
            <Switch checked={isRandomized} onCheckedChange={setIsRandomized} />
          </div>
          {/* 행 액션은 설정 카드 우측 끝 — 이 카드는 스크롤되지 않으므로 항상 보임 */}
          <div className="ml-auto flex items-center gap-2">
            {selectedCount > 0 && (
              <Button
                onClick={() => setRows(rows.filter(r => !r.selected))}
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={14} strokeWidth={1.5} /> <span className="tabular-nums">{selectedCount}</span>개 삭제
              </Button>
            )}
            <Button onClick={handleSave} size="sm" className="h-9 gap-1.5 px-6">
              <Save size={14} strokeWidth={1.5} /> 저장
            </Button>
          </div>
        </div>
      </div>

      {/* 테이블 카드 — 남은 높이를 채우고 내부에서만 스크롤 (thead sticky·하단 액션바가 항상 보이도록) */}
      <div className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="shrink-0 border-b border-border bg-muted/60 px-4 py-1">
          <div ref={topScrollRef} className="custom-scrollbar h-3 overflow-x-auto overflow-y-hidden">
            <div style={{ width: TABLE_MIN_WIDTH, height: "1px" }} />
          </div>
        </div>
        <div ref={tableContainerRef} className="scrollbar-vertical min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: TABLE_MIN_WIDTH }}>
            <colgroup>
              <col style={{ width: SELECT_COL_W }} />
              {COLUMNS.map(col => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 border-b border-border bg-[hsl(var(--muted))]">
              <tr>
                <th className="sticky left-0 z-30 border-r border-border bg-[hsl(var(--muted))] px-4 py-3.5 text-left">
                  <input type="checkbox" checked={rows.length > 0 && rows.every(r => r.selected)} onChange={e => setRows(rows.map(r => ({ ...r, selected: e.target.checked })))} className={CHECKBOX} />
                </th>
                {COLUMNS.map((col, colIdx) => (
                  <th
                    key={col.key}
                    style={colIdx === 0 ? { left: SELECT_COL_W } : undefined}
                    className={`px-4 py-3.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap${
                      colIdx === 0 ? " sticky z-30 border-r border-border bg-[hsl(var(--muted))] shadow-[2px_0_5px_rgba(0,0,0,0.04)]" : ""
                    }`}
                  >
                    {col.key === "displayNo" ? (
                      <span className="flex items-center gap-1">
                        {col.label}
                        <button
                          onClick={sortByDisplayNo}
                          title="순번대로 전체 정렬"
                          aria-label="순번대로 정렬"
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground"
                        >
                          <ArrowDownUp size={12} strokeWidth={1.8} />
                        </button>
                      </span>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.id} className="group border-b border-border/60 transition-colors hover:bg-muted/50">
                  {/* 고정 열은 배경 불투명 필수 — 알파면 스크롤 시 아래 셀이 비침.
                      헤더 th와 동일한 px-4를 써야 체크박스 세로줄이 맞음 */}
                  <td className="sticky left-0 z-10 border-r border-border bg-card px-4 py-3 align-middle group-hover:bg-muted">
                    <div className="flex items-center gap-1.5">
                      <input type="checkbox" checked={row.selected} onChange={() => setRows(rows.map(r => (r.id === row.id ? { ...r, selected: !r.selected } : r)))} className={CHECKBOX} />
                      {/* 좌: 맨 위/맨 아래로, 우: 한 칸씩 */}
                      <div className="grid grid-cols-2 gap-x-0.5">
                        <button disabled={rowIdx === 0} onClick={() => moveRow(rowIdx, 0)} title="맨 위로" aria-label="맨 위로 이동" className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronsUp size={12} strokeWidth={1.8} /></button>
                        <button disabled={rowIdx === 0} onClick={() => moveRow(rowIdx, rowIdx - 1)} title="위로" aria-label="위로 이동" className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp size={12} strokeWidth={1.8} /></button>
                        <button disabled={rowIdx === rows.length - 1} onClick={() => moveRow(rowIdx, rows.length - 1)} title="맨 아래로" aria-label="맨 아래로 이동" className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronsDown size={12} strokeWidth={1.8} /></button>
                        <button disabled={rowIdx === rows.length - 1} onClick={() => moveRow(rowIdx, rowIdx + 1)} title="아래로" aria-label="아래로 이동" className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown size={12} strokeWidth={1.8} /></button>
                      </div>
                    </div>
                  </td>
                  {COLUMNS.map((col, colIdx) => {
                    if (col.type === "image") return (<td key={col.key} className="px-4 py-3 align-middle">{renderImageCell(row, col.key, col.limit || 1)}</td>);
                    return (
                      <td
                        key={col.key}
                        style={colIdx === 0 ? { left: SELECT_COL_W } : undefined}
                        className={`px-4 py-3 align-middle${
                          colIdx === 0 ? " sticky z-10 border-r border-border bg-card shadow-[2px_0_5px_rgba(0,0,0,0.04)] group-hover:bg-muted" : ""
                        }`}
                      >
                        {/* -mx-2로 셀 패딩을 상쇄해 헤더 라벨과 글자 시작점을 맞춤 */}
                        <textarea
                          value={(row as any)[col.key]}
                          onChange={e => setRows(rows.map(r => (r.id === row.id ? { ...r, [col.key]: e.target.value } : r)))}
                          title={(row as any)[col.key] || undefined}
                          className={`-mx-2 min-h-[24px] w-[calc(100%+1rem)] resize-none overflow-hidden rounded-md bg-transparent px-2 py-1 transition-colors placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
                            colIdx === 0 ? "text-sm font-medium" : "text-xs"
                          }`}
                          rows={1}
                          placeholder="-"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 행 추가 */}
        <button onClick={() => setRows([...rows, emptyRow()])} aria-label="행 추가" className="flex w-full shrink-0 justify-center border-t border-border/60 py-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
          <Plus size={20} strokeWidth={1.5} />
        </button>
        {/* 하단 정보 바 */}
        <div className="flex shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            전체 <span className="tabular-nums text-foreground">{rows.length}</span>개
            {selectedCount > 0 && <> · <span className="tabular-nums text-foreground">{selectedCount}</span>개 선택</>}
          </p>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminEvaluationDetailPage;
