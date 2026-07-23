import React, { useState, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { db, storage } from "@/firebase";
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, writeBatch, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Menu, Lock, Shirt, LogOut, Bell, Plus, Trash2, Save, Upload, Download, X, Home, ChevronUp, ChevronDown } from "lucide-react";
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
  { key: "styleNo", label: "품번" },
  { key: "thumbnail", label: "썸네일 (1)", type: "image", limit: 1 },
  { key: "productImages", label: "단품이미지 (15)", type: "image", limit: 15 },
  // 코디이미지 컬럼 삭제 (2026-07-23 — 코디평가 페이지 숨김에 따라 상품정보 슬라이더로 통합).
  // 데이터(Coord_image_urls)는 ZIP 업로드·저장 로직에서 계속 유지됨
  // { key: "coordiImages", label: "코디이미지 (6)", type: "image", limit: 6 },
  { key: "price", label: "판매가" },
  { key: "fabricName", label: "원단명" },
  { key: "composition", label: "혼용률" },
  { key: "fabricWidth", label: "원단폭" },
  { key: "unitPrice", label: "단가" },
  { key: "mu", label: "M/U" },
  { key: "consumption", label: "요척" },
  { key: "rawMaterial", label: "원자재" },
  { key: "subsidiary", label: "부자재" },
  { key: "specialSubsidiary", label: "특수부자재" },
  { key: "laborCost", label: "공임비" },
  { key: "cogs", label: "제조원가" },
  { key: "addLaborInfo", label: "추가공임정보" },
  { key: "otherMaterialInfo", label: "기타원자재정보" },
  { key: "miniDeliStock", label: "MINI/DELI_재고/선발주" },
];

const AdminEvaluationDetailPage = () => {
  const { id } = useParams();
  const { logout, refreshData } = useAppContext();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  const uploadToFirebase = async (file: File, styleNo: string, category: string) => {
    const compressionOptions = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
    let compressedFile: File = file;
    try {
      compressedFile = await imageCompression(file, compressionOptions);
    } catch {
      compressedFile = file;
    }
    const ext = file.name.split(".").pop() || "";
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const fileName = `${Date.now()}_${baseName}.${ext}`;
    const filePath = `product_image/${styleNo}/${category}/${fileName}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, compressedFile);
    return await getDownloadURL(storageRef);
  };

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
              const comp = await imageCompression(original, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true });
              final = new File([comp], fileName, { type: comp.type });
            } catch (err) {}
          }
          const url = URL.createObjectURL(final);
          const row = { ...tempRows[rowIndex] };
          if (category === "thumbnail") { row.thumbnail = [url]; row.thumbnailFile = final; }
          else if (category === "product" && row.productImages.length < 15) { row.productImages = [...row.productImages, url]; row.productImageFiles = [...(row.productImageFiles || []), final]; }
          else if (category === "coordi" && row.coordiImages.length < 6) { row.coordiImages = [...row.coordiImages, url]; row.coordiImageFiles = [...(row.coordiImageFiles || []), final]; }
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
        const c = await imageCompression(f, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true });
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

  const renderImageCell = (row: ProductRow, type: any, limit: number) => {
    const images = (row as any)[type] as string[];
    const rowIndex = rows.findIndex(r => r.id === row.id);
    const deleteType = type === "productImages" ? "product" : type === "coordiImages" ? "coordi" : "thumbnail";
    const sortable = type !== "thumbnail";

    return (
      <div className="flex items-center gap-1.5 min-w-[80px]">
        {images.map((url, i) => (
          <div
            key={url + i}
            draggable={sortable}
            onDragStart={sortable ? () => setDragInfo({ rowId: row.id, type, index: i }) : undefined}
            onDragEnd={sortable ? () => setDragInfo(null) : undefined}
            onDragOver={sortable ? (e) => { e.preventDefault(); } : undefined}
            onDrop={sortable ? (e) => { e.preventDefault(); handleReorderImage(row.id, type, i); } : undefined}
            className={`relative h-10 w-10 rounded border border-slate-200 overflow-hidden shrink-0 group${sortable ? " cursor-grab active:cursor-grabbing" : ""}${dragInfo && dragInfo.rowId === row.id && dragInfo.type === type && dragInfo.index === i ? " opacity-40 ring-2 ring-blue-400" : ""}`}
            title={sortable ? "드래그해서 순서 변경" : undefined}
          >
            <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover pointer-events-none" />
            <button onClick={() => handleDeleteImage(rowIndex, deleteType, i, url)} className="absolute top-0.5 right-0.5 bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
          </div>
        ))}
        {images.length < limit && (
          <button
            onClick={() => { setActiveUpload({ rowId: row.id, type, limit }); fileInputRef.current?.click(); }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("bg-blue-50"); }}
            onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove("bg-blue-50"); }}
            onDrop={e => {
              e.preventDefault(); e.currentTarget.classList.remove("bg-blue-50");
              // 내부 이미지 드래그를 + 버튼에 놓으면 맨 뒤로 이동, 외부 파일 드롭이면 기존 업로드 동작
              if (dragInfo && dragInfo.rowId === row.id && dragInfo.type === type) {
                handleReorderImage(row.id, type, images.length - 1);
              } else {
                handleDropFiles(Array.from(e.dataTransfer.files), row.id, type, limit);
              }
            }}
            className="h-10 w-10 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0 hover:border-slate-400 transition-colors"
          ><Plus size={14} /></button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans antialiased text-slate-900 transition-all duration-300">
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
              const c = await imageCompression(f, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true });
              compressed.push(new File([c], f.name, { type: f.type }));
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

      <aside className={`flex flex-col justify-between bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? "w-56" : "w-16"}`}>
        <div>
          <div className="flex h-14 items-center justify-center border-b border-slate-700">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="rounded-md p-2 hover:bg-slate-800 transition-colors"><Menu size={22} /></button>
          </div>
          <nav className="mt-4 flex flex-col gap-1 px-2">
            <button onClick={() => navigate("/admin/accounts")} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"><Lock size={18} className="shrink-0" />{isSidebarOpen && <span>계정관리</span>}</button>
            <button onClick={() => navigate("/admin/evaluations")} className="flex items-center gap-3 rounded-lg bg-slate-800 px-3.5 py-3 text-sm font-medium text-white transition-colors"><Shirt size={18} className="shrink-0" />{isSidebarOpen && <span>품평관리</span>}</button>
          </nav>
        </div>
        <div className="mb-4 flex flex-col gap-1 px-2 border-t border-slate-700 pt-4">
          <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"><LogOut size={18} className="shrink-0" />{isSidebarOpen && <span>로그아웃</span>}</button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm z-10">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">품평 상세</h2>
          <button className="relative rounded-full p-2 hover:bg-slate-100 transition-colors"><Bell size={20} className="text-slate-600" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3"><span className="text-xs font-bold bg-slate-900 text-white px-3 py-2 rounded-md shrink-0">품평 이름</span><Input value={evaluationName} onChange={e => setEvaluationName(e.target.value)} placeholder="품평회 명칭 입력" className="w-52 h-10 text-sm" /></div>
              <div className="flex items-center gap-3"><span className="text-xs font-bold bg-slate-900 text-white px-3 py-2 rounded-md shrink-0">기간</span><div className="flex items-center gap-2"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 h-10 text-sm" /><span className="text-slate-400">~</span><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 h-10 text-sm" /></div></div>
              <div className="flex items-center gap-6"><div className="flex items-center gap-3"><span className="text-xs font-bold bg-slate-900 text-white px-3 py-2 rounded-md shrink-0">스타일 랜덤배열</span><Switch checked={isRandomized} onCheckedChange={setIsRandomized} /></div></div>
              <div className="ml-auto flex items-center gap-3">
                <Button onClick={() => setRows(rows.filter(r => !r.selected))} variant="outline" size="sm" className="h-10 text-red-600 border-slate-200 hover:bg-red-50"><Trash2 size={16} /> 삭제</Button>
                <Button onClick={handleSave} size="sm" className="h-10 px-6 bg-slate-900 text-white hover:bg-slate-800"><Save size={16} /> 저장</Button>
                <button onClick={() => csvInputRef.current?.click()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm h-10"><Upload size={14} /> 상품정보 업로드</button>
                <button onClick={() => zipInputRef.current?.click()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm h-10"><Upload size={14} /> 이미지 업로드</button>
                <button onClick={handleTemplateDownload} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm h-10"><Download size={14} /> 양식 다운로드</button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col relative">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-1"><div ref={topScrollRef} className="custom-scrollbar overflow-x-auto overflow-y-hidden h-3 max-w-[50%]"><div style={{ width: "3500px", height: "1px" }} /></div></div>
            <div ref={tableContainerRef} className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              <table className="w-full text-sm text-slate-700 border-collapse table-auto min-w-[3500px]">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                  <tr>
                    <th className="sticky left-0 z-30 bg-slate-50 px-4 py-4 text-left w-12 border-r border-slate-100"><input type="checkbox" checked={rows.length > 0 && rows.every(r => r.selected)} onChange={e => setRows(rows.map(r => ({ ...r, selected: e.target.checked })))} className="h-4 w-4 rounded border-slate-300 accent-slate-900" /></th>
                    {COLUMNS.map(col => (<th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-slate-600 whitespace-nowrap">{col.label}</th>))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, rowIdx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-2 py-3 align-middle border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-1">
                          <input type="checkbox" checked={row.selected} onChange={() => setRows(rows.map(r => (r.id === row.id ? { ...r, selected: !r.selected } : r)))} className="h-4 w-4 rounded border-slate-300 accent-slate-900" />
                          <div className="flex flex-col">
                            <button disabled={rowIdx === 0} onClick={() => { const newRows = [...rows]; [newRows[rowIdx - 1], newRows[rowIdx]] = [newRows[rowIdx], newRows[rowIdx - 1]]; setRows(newRows); }} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={12} /></button>
                            <button disabled={rowIdx === rows.length - 1} onClick={() => { const newRows = [...rows]; [newRows[rowIdx], newRows[rowIdx + 1]] = [newRows[rowIdx + 1], newRows[rowIdx]]; setRows(newRows); }} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={12} /></button>
                          </div>
                        </div>
                      </td>
                      {COLUMNS.map(col => {
                        if (col.type === "image") return (<td key={col.key} className="px-6 py-3 align-middle">{renderImageCell(row, col.key, col.limit || 1)}</td>);
                        return (<td key={col.key} className="px-6 py-3 align-middle min-w-[150px]"><textarea value={(row as any)[col.key]} onChange={e => setRows(rows.map(r => (r.id === row.id ? { ...r, [col.key]: e.target.value } : r)))} className="w-full bg-transparent border-none focus:ring-0 text-xs p-0 resize-none overflow-hidden min-h-[20px]" rows={1} placeholder="-" /></td>);
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/30"><button onClick={() => setRows([...rows, emptyRow()])} className="w-full py-4 flex justify-center text-slate-400 hover:bg-slate-50 transition-colors"><Plus size={24} /></button></div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminEvaluationDetailPage;
