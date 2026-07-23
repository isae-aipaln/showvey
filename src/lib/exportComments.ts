import ExcelJS from "exceljs";
import { normalizeStyleNo } from "@/lib/utils";

interface ExportProduct {
  styleCode: string;
  thumbnailImage?: string;
  productImages: string[];
}

interface ExportEvaluation {
  Style_no: string;
  Comment: string | null;
  Evaluator_ID: string | null;
  Liked_images?: string[] | null;
}

// 좋아요 이미지 URL → 축소된 JPEG 버퍼 (엑셀 파일 크기 억제용). 실패 시 null
export async function urlToSmallImage(
  url: string,
  maxH = 300,
): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxH / bmp.height);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";   // PNG 투명배경 → 흰색
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const outBlob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.82));
    return { buffer: await outBlob.arrayBuffer(), width: w, height: h };
  } catch {
    return null;
  }
}

const IMAGE_WIDTH = 213; // 2:3 비율 (320 * 2/3)
const IMAGE_HEIGHT = 320; // px
const ROW_HEIGHT = 243; // points (≈ 320px)
const COL_IMAGE_WIDTH = 30; // chars (≈ 180px)

async function urlToBuffer(url: string): Promise<{ buffer: ArrayBuffer; ext: "png" | "jpeg" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("Content-Type") || "";
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    
    // MIME 타입을 기준으로 확장자 판별 (더 정확함)
    const ext: "png" | "jpeg" = contentType.includes("png") ? "png" : "jpeg";
    return { buffer, ext };
  } catch (error) {
    console.error("urlToBuffer error:", error);
    return null;
  }
}

export async function buildCommentsWorkbookBlob(params: {
  evaluations: ExportEvaluation[];
  products: ExportProduct[];
  evaluatorId: string;
}): Promise<{ blob: Blob; count: number }> {
  const { evaluations, products, evaluatorId } = params;

  // 1) 본인이 평가한 항목만 필터
  const myEvals = evaluations.filter(
    (e) => e.Evaluator_ID === evaluatorId && e.Style_no,
  );

  if (myEvals.length === 0) {
    throw new Error("내려받을 평가 데이터가 없습니다.");
  }

  // 2) Style_no -> images 매핑 (썸네일 우선, 1장만)
  const productMap = new Map<string, string[]>();
  products.forEach((p) => {
    const mainImage = p.thumbnailImage || (p.productImages && p.productImages[0]);
    productMap.set(normalizeStyleNo(p.styleCode), mainImage ? [mainImage] : []);
  });

  // 3) 워크북/워크시트 생성
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Comments");
  sheet.columns = [
    { header: "Style_no", key: "style", width: 18 },
    { header: "Product_image", key: "image", width: COL_IMAGE_WIDTH },
    { header: "Comment", key: "comment", width: 60 },
    { header: "좋아요 수", key: "likeCount", width: 10 },
    { header: "좋아요 이미지", key: "likeImages", width: COL_IMAGE_WIDTH },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  let currentRow = 2;

  for (const ev of myEvals) {
    const styleNo = ev.Style_no;
    const comment = ev.Comment ?? "";
    const images = productMap.get(normalizeStyleNo(styleNo)) ?? [];
    const likedArr = Array.isArray(ev.Liked_images) ? ev.Liked_images : [];
    // 좋아요 이미지는 E열에 세로로 쌓으므로, 행 수는 상품/좋아요 이미지 중 많은 쪽
    const rowCount = Math.max(1, images.length, likedArr.length);

    // 첫 행에 Style_no, Comment, 좋아요 수 기입
    const startRow = currentRow;
    sheet.getCell(`A${startRow}`).value = styleNo;
    sheet.getCell(`A${startRow}`).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell(`C${startRow}`).value = comment;
    sheet.getCell(`C${startRow}`).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    sheet.getCell(`D${startRow}`).value = likedArr.length || null;
    sheet.getCell(`D${startRow}`).alignment = { vertical: "middle", horizontal: "center" };

    // 여러 행에 걸친 경우 셀 병합
    if (rowCount > 1) {
      sheet.mergeCells(`A${startRow}:A${startRow + rowCount - 1}`);
      sheet.mergeCells(`C${startRow}:C${startRow + rowCount - 1}`);
      sheet.mergeCells(`D${startRow}:D${startRow + rowCount - 1}`);
    }

    // 모든 행 높이 설정
    for (let i = 0; i < rowCount; i++) {
      sheet.getRow(startRow + i).height = ROW_HEIGHT;
    }

    // 상품 이미지 (B열)
    const fetched = await Promise.all(images.map((url) => urlToBuffer(url)));
    for (let i = 0; i < images.length; i++) {
      const img = fetched[i];
      if (!img) continue;
      const imageId = workbook.addImage({
        buffer: img.buffer,
        extension: img.ext,
      });
      // B열 = column index 1 (0-indexed)
      sheet.addImage(imageId, {
        tl: { col: 1.05, row: startRow + i - 1 + 0.05 } as any,
        ext: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
        editAs: "oneCell",
      });
    }

    // 좋아요 이미지 (E열, 실제 이미지 삽입 — 파일명은 서버(Liked_images)에만 보관)
    const likedFetched = await Promise.all(likedArr.map((url) => urlToSmallImage(url, IMAGE_HEIGHT)));
    for (let i = 0; i < likedArr.length; i++) {
      const img = likedFetched[i];
      if (!img) continue;
      const imageId = workbook.addImage({ buffer: img.buffer, extension: "jpeg" });
      // E열 = column index 4 (0-indexed)
      sheet.addImage(imageId, {
        tl: { col: 4.05, row: startRow + i - 1 + 0.05 } as any,
        ext: { width: img.width, height: img.height },
        editAs: "oneCell",
      });
    }

    currentRow += rowCount;
  }

  // 4) Blob 반환
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return { blob, count: myEvals.length };
}

function defaultFileName(evaluatorId: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `comments_${evaluatorId}_${stamp}.xlsx`;
}

export async function exportCommentsToExcel(params: {
  evaluations: ExportEvaluation[];
  products: ExportProduct[];
  evaluatorId: string;
  fileName?: string;
}) {
  const { blob, count } = await buildCommentsWorkbookBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = params.fileName ?? defaultFileName(params.evaluatorId);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { count };
}

export async function shareCommentsExcel(params: {
  evaluations: ExportEvaluation[];
  products: ExportProduct[];
  evaluatorId: string;
  fileName?: string;
}): Promise<{ count: number; method: "share" | "download" }> {
  const { blob, count } = await buildCommentsWorkbookBlob(params);
  const fileName = params.fileName ?? defaultFileName(params.evaluatorId);
  const file = new File([blob], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: fileName,
        text: "품평 메모",
      });
      return { count, method: "share" };
    } catch (err: any) {
      // 사용자가 공유 시트를 취소한 경우
      if (err?.name === "AbortError") {
        throw err;
      }
      // 그 외 실패 시 다운로드로 fallback
    }
  }

  // Fallback: 다운로드
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { count, method: "download" };
}
