import imageCompression from "browser-image-compression";
import { storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * 상품 이미지 업로드 공통 처리 (관리자 품평상세 · 스타일 등록 두 경로가 공유).
 *
 * **JPEG로 변환해서 저장한다.** PNG는 무손실이라 품질로 용량을 줄일 수 없어,
 * 0.5MB 상한을 맞추려면 압축 라이브러리가 해상도를 깎는 수밖에 없다.
 * 실측: 같은 원본(1460×813)이 PNG 유지 시 794×439/465KB, JPEG 변환 시 1200×668/299KB —
 * 해상도는 1.5배 올라가는데 용량은 오히려 35% 줄어든다.
 *
 * 투명 PNG는 라이브러리가 흰색으로 합성하므로 흰 배경 상품컷과 결과가 같다.
 */
/**
 * 상세 화면용(단품·코디) — 긴 변 1600px.
 * JPEG로 바꾸고 나니 기존 1200px 상한이 새 병목이었다. 실측(1024×1536 상품컷)으로
 * 1200 상한이면 800×1200/72KB로 깎이지만 1600이면 원본 그대로 유지하고도 200KB다.
 * 상세 프레임이 615px이라 고해상도 모니터·확대보기까지 커버된다.
 */
export const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.85,
};

/**
 * 갤러리 카드용 축소본 — 긴 변 700px.
 * 카드가 PC 최대 220px(고해상도 2배 = 440), 모바일 3열 약 143px(2배 = 286)이라
 * 세로 700px이면 어느 화면에서도 선명하다. 상세용 원본을 그대로 받던 것을 대체한다.
 */
export const THUMBNAIL_OPTIONS = {
  maxSizeMB: 0.2,
  maxWidthOrHeight: 700,
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.8,
};

/** 업로드 분류에 맞는 압축 프리셋 (관리자 화면의 두 가지 표기를 모두 받는다) */
export const compressionOptionsFor = (category: string) =>
  category === "thumbnail" ? THUMBNAIL_OPTIONS : COMPRESSION_OPTIONS;

/** 압축(JPEG 변환) 후 확장자를 실제 형식에 맞춘 파일명을 만든다 */
export const compressForUpload = async (file: File, category = "product") => {
  let compressed: File = file;
  try {
    compressed = await imageCompression(file, compressionOptionsFor(category));
  } catch {
    compressed = file; // 변환 실패 시 원본 그대로 (업로드 자체를 막지는 않는다)
  }
  const originalExt = file.name.split(".").pop() || "";
  const ext = compressed.type === "image/jpeg" ? "jpg" : originalExt;
  const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return { file: compressed, fileName: `${Date.now()}_${baseName}.${ext}` };
};

/** product_image/{품번}/{분류}/{파일명} 으로 업로드하고 다운로드 URL을 반환 */
export const uploadProductImage = async (file: File, styleNo: string, category: string) => {
  const { file: compressed, fileName } = await compressForUpload(file, category);
  const storageRef = ref(storage, `product_image/${styleNo}/${category}/${fileName}`);
  await uploadBytes(storageRef, compressed);
  return await getDownloadURL(storageRef);
};
