import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { urlToSmallImage } from "@/lib/exportComments";
import { useAppContext } from "@/context/AppContext";
import { db, storage } from "@/firebase";
import { collection, getDocs, query, orderBy, deleteDoc, doc, where, writeBatch } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import {
  Menu,
  Lock,
  Shirt,
  LogOut,
  Bell,
  Plus,
  Trash2,
  FileSpreadsheet,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import { toast } from "sonner";

interface EvaluationItem {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  styleCount: number;
  isOngoing: boolean;
  isRandomized: boolean;
  selected: boolean;
}

const AdminEvaluationPage = () => {
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);

  // ⭐ 데이터 저장소(localStorage) 대신 Supabase에서 목록 불러오기
  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      const projectsRef = collection(db, "projects");
      const q = query(projectsRef, orderBy("__name__", "desc")); // 문서 ID(Project_name) 기준 정렬
      const snapshot = await getDocs(q);

      const formattedData = snapshot.docs.map((doc) => {
        const item = doc.data();
        const periodParts = item.Period ? item.Period.split(" ~ ") : ["-", "-"];

        return {
          id: doc.id,
          name: doc.id,
          periodStart: periodParts[0] || "-",
          periodEnd: periodParts[1] || "-",
          styleCount: item.Total_style || 0,
          isOngoing: item.Status || false,
          isRandomized: item.Arrangement === "랜덤배열",
          selected: false,
        };
      });

      setEvaluations(formattedData);
    } catch (error: any) {
      console.error("데이터 불러오기 실패:", error.message);
      toast.error("품평 목록을 불러오는 데 실패했습니다.");
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(evaluations.length / itemsPerPage) || 1;
  const currentItems = evaluations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleAll = (checked: boolean) => setEvaluations(evaluations.map((item) => ({ ...item, selected: checked })));

  // ⭐ Storage 에러 방어 + Firestore Batch 450건 Chunking 적용 삭제 로직
  const handleDelete = async () => {
    const selectedItems = evaluations.filter((item) => item.selected);
    if (selectedItems.length === 0) return toast.error("삭제할 품평을 선택해주세요.");

    const projectNamesToDelete = selectedItems.map((item) => item.name);
    const loadingToast = toast.loading("관련된 스토리지 이미지와 데이터를 모두 삭제 중입니다...");

    let hasStorageError = false;

    try {
      for (const projectName of projectNamesToDelete) {
        // 1. 상품 정보 조회 (이미지 URL 추출 + DB 삭제용)
        const productsRef = collection(db, "products");
        const qProducts = query(productsRef, where("Project_name", "==", projectName));
        const productSnapshot = await getDocs(qProducts);

        // 2. Storage 파일 삭제 (Firebase URL만 필터링, 에러 방어)
        try {
          const allImageUrls: string[] = [];
          productSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.Thumbnail_url) allImageUrls.push(data.Thumbnail_url);
            if (Array.isArray(data.Product_image_urls)) allImageUrls.push(...data.Product_image_urls);
            if (Array.isArray(data.Coord_image_urls)) allImageUrls.push(...data.Coord_image_urls);
          });

          // firebasestorage.googleapis.com 포함 URL만 삭제 대상 (Supabase 등 외부 URL 무시)
          const firebaseUrls = allImageUrls.filter(
            (url) => typeof url === "string" && url.includes("firebasestorage.googleapis.com")
          );

          const deleteResults = await Promise.allSettled(
            firebaseUrls.map((url) => {
              try {
                const decodedUrl = decodeURIComponent(url);
                const pathPart = decodedUrl.split("/o/")[1]?.split("?")[0];
                if (pathPart) {
                  const imageRef = ref(storage, pathPart);
                  return deleteObject(imageRef);
                }
                return Promise.resolve();
              } catch (e) {
                return Promise.reject(e);
              }
            })
          );

          if (deleteResults.some((r) => r.status === "rejected")) {
            hasStorageError = true;
          }
        } catch (e) {
          console.error(`Storage 삭제 중 에러 (${projectName}):`, e);
          hasStorageError = true;
        }

        // 3. Firestore 데이터 삭제 (450건씩 Chunking)
        const allDeleteRefs: ReturnType<typeof doc>[] = [];

        // projects 삭제
        allDeleteRefs.push(doc(db, "projects", projectName));

        // products 삭제
        productSnapshot.docs.forEach((d) => allDeleteRefs.push(d.ref));

        // evaluations 삭제
        const evalsRef = collection(db, "evaluations");
        const qEvals = query(evalsRef, where("Project_name", "==", projectName));
        const evalSnapshot = await getDocs(qEvals);
        evalSnapshot.docs.forEach((d) => allDeleteRefs.push(d.ref));

        // 450건씩 나누어 batch commit (Firestore 500건 제한 우회)
        const CHUNK_SIZE = 450;
        for (let i = 0; i < allDeleteRefs.length; i += CHUNK_SIZE) {
          const chunk = allDeleteRefs.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((docRef) => batch.delete(docRef));
          await batch.commit();
        }
      }

      const filtered = evaluations.filter((item) => !item.selected);
      setEvaluations(filtered);

      toast.dismiss(loadingToast);
      if (hasStorageError) {
        toast.warning("프로젝트는 삭제되었으나 일부 이미지가 Storage에 남았을 수 있습니다.");
      } else {
        toast.success("선택한 품평의 모든 이미지와 데이터가 완벽히 삭제되었습니다.");
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(`삭제 실패: ${error.message}`);
    }
  };

  // ⭐ CSV 다운로드 처리 함수 추가
  const handleDownloadCsv = async (projectName: string) => {
    try {
      toast.loading(`${projectName} 데이터를 불러오는 중...`, { id: "csv-download" });

      // 1-1. 사용자 권한 정보 가져오기
      const usersRef = collection(db, "users");
      const userSnapshot = await getDocs(usersRef);
      const userRoleMap: Record<string, string> = {};
      userSnapshot.docs.forEach(doc => {
        userRoleMap[doc.id] = doc.data().role || "";
      });

      // 1-2. 평가 데이터 가져오기
      const evalsRef = collection(db, "evaluations");
      const q = query(evalsRef, where("Project_name", "==", projectName));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      if (data.length === 0) {
        toast.dismiss("csv-download");
        toast.error("해당 프로젝트의 평가 데이터가 없습니다.");
        return;
      }

      // 2. 엑셀(xlsx) 구성 — 좋아요 이미지를 실제 이미지로 삽입 (파일명/URL은 서버에만 보관)
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("평가결과");
      sheet.columns = [
        { header: "ROLE", key: "role", width: 10 },
        { header: "ID", key: "id", width: 20 },
        { header: "품번", key: "style", width: 18 },
        { header: "구매 의사", key: "pi", width: 10 },
        { header: "희망주문량", key: "oc", width: 11 },
        { header: "가격", key: "price", width: 8 },
        { header: "총평", key: "comment", width: 50 },
        { header: "좋아요 수", key: "likeCount", width: 9 },
        { header: "좋아요 이미지", key: "likeImages", width: 22 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      const LIKE_H = 180;       // 삽입 이미지 높이(px)
      const LIKE_ROW_PT = 140;  // 좋아요 있는 행 높이(pt)
      // 같은 이미지는 한 번만 넣고 재사용 (파일 크기 억제)
      const imgIdCache = new Map<string, number | null>();
      const imgDimCache = new Map<string, { width: number; height: number }>();

      // 고유 좋아요 이미지를 6장씩 병렬로 선다운로드 (한 장씩 순차 다운로드하면 느려서)
      const uniqueUrls = [...new Set((data as any[]).flatMap((r) => (Array.isArray(r.Liked_images) ? r.Liked_images : [])))] as string[];
      const CONC = 6;
      for (let i = 0; i < uniqueUrls.length; i += CONC) {
        const chunk = uniqueUrls.slice(i, i + CONC);
        toast.loading(`좋아요 이미지 처리 중... (${Math.min(i + CONC, uniqueUrls.length)}/${uniqueUrls.length})`, { id: "csv-download" });
        const results = await Promise.all(chunk.map((u) => urlToSmallImage(u, LIKE_H)));
        results.forEach((img, j) => {
          const u = chunk[j];
          if (img) {
            imgIdCache.set(u, workbook.addImage({ buffer: img.buffer, extension: "jpeg" }));
            imgDimCache.set(u, { width: img.width, height: img.height });
          } else {
            imgIdCache.set(u, null);
          }
        });
      }

      toast.loading("엑셀 생성 중...", { id: "csv-download" });
      let currentRow = 2;
      for (const row of data as any[]) {
        const likedArr: string[] = Array.isArray(row.Liked_images) ? row.Liked_images : [];
        const rowCount = Math.max(1, likedArr.length);
        const startRow = currentRow;
        const vals: any[] = [
          userRoleMap[row.Evaluator_ID] || "",
          row.id,
          row.Style_no || "",
          row.Purchase_intent || "",
          row.Order_count || "",
          row.Price || "",
          row.Comment || "",
          likedArr.length || null,
        ];
        ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((colL, ci) => {
          const cell = sheet.getCell(`${colL}${startRow}`);
          cell.value = vals[ci];
          cell.alignment = { vertical: "middle", horizontal: colL === "G" ? "left" : "center", wrapText: true };
          if (rowCount > 1) sheet.mergeCells(`${colL}${startRow}:${colL}${startRow + rowCount - 1}`);
        });
        if (likedArr.length > 0) {
          for (let i = 0; i < rowCount; i++) sheet.getRow(startRow + i).height = LIKE_ROW_PT;
        }
        // 좋아요 이미지 삽입 (I열, 세로로 쌓음) — 선다운로드된 캐시만 사용
        for (let i = 0; i < likedArr.length; i++) {
          const imageId = imgIdCache.get(likedArr[i]);
          if (imageId === null || imageId === undefined) continue;
          const dim = imgDimCache.get(likedArr[i])!;
          sheet.addImage(imageId, {
            tl: { col: 8.05, row: startRow + i - 1 + 0.05 } as any,
            ext: { width: dim.width, height: dim.height },
            editAs: "oneCell",
          });
        }
        currentRow += rowCount;
      }

      // 3. 파일 다운로드 실행 (xlsx)
      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${projectName}_평가결과.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss("csv-download");
      toast.success("평가결과 엑셀 다운로드가 완료되었습니다.");
    } catch (err) {
      console.error("CSV Download Error:", err);
      toast.dismiss("csv-download");
      toast.error("파일 다운로드 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans antialiased text-slate-900 transition-all duration-300">
      <aside
        className={`flex flex-col justify-between bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? "w-56" : "w-16"}`}
      >
        <div>
          <div className="flex h-14 items-center justify-center border-b border-slate-700">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-md p-2 hover:bg-slate-800 transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>
          <nav className="mt-4 flex flex-col gap-1 px-2">
            <button
              onClick={() => navigate("/admin/accounts")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Lock size={18} className="shrink-0" />
              {isSidebarOpen && <span>계정관리</span>}
            </button>
            <button className="flex items-center gap-3 rounded-lg bg-slate-800 px-3.5 py-3 text-sm font-medium text-white transition-colors">
              <Shirt size={18} className="shrink-0" />
              {isSidebarOpen && <span>품평관리</span>}
            </button>
          </nav>
        </div>
        <div className="mb-4 flex flex-col gap-1 px-2 border-t border-slate-700 pt-4">
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            {isSidebarOpen && <span>로그아웃</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm z-10">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">품평관리</h2>
          <button className="relative rounded-full p-2 hover:bg-slate-100 transition-colors">
            <Bell size={20} className="text-slate-600" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="text-base font-semibold text-slate-700 tracking-tight">품평 프로젝트 목록</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm"
              >
                <Trash2 size={14} className="text-red-500" /> 삭제
              </button>
              {/* ⭐ 새로 만들기 클릭 시 'new' 파라미터 전달 */}
              <button
                onClick={() => navigate("/admin/evaluations/new")}
                className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus size={16} /> 새로 만들기
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <table className="w-full text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr className="font-bold text-slate-700 tracking-tight">
                  <th className="w-16 px-6 py-6 text-left align-middle">
                    <input
                      type="checkbox"
                      checked={currentItems.length > 0 && currentItems.every((i) => i.selected)}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900 align-middle"
                    />
                  </th>
                  <th className="px-6 py-6 text-left text-base min-w-[200px] align-middle">품평 이름</th>
                  <th className="px-6 py-6 text-left text-base align-middle">기간</th>
                  <th className="px-6 py-6 text-center text-base align-middle">스타일 수</th>
                  <th className="px-6 py-6 text-center text-base align-middle">진행상태</th>
                  <th className="px-6 py-6 text-center text-base align-middle">스타일 배열</th>
                  <th className="px-6 py-6 text-center text-base align-middle">파일 다운로드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.length > 0 ? (
                  currentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5 align-middle">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() =>
                            setEvaluations(
                              evaluations.map((e) => (e.id === item.id ? { ...e, selected: !e.selected } : e)),
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 accent-slate-900 align-middle"
                        />
                      </td>
                      <td className="px-6 py-5 align-middle font-semibold text-slate-900">
                        {/* ⭐ 품평 이름 클릭 시 해당 프로젝트의 ID를 경로에 포함하여 이동 */}
                        <button
                          onClick={() => navigate(`/admin/evaluations/${item.id}`)}
                          className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                        >
                          {item.name} <ExternalLink size={13} className="text-slate-300" />
                        </button>
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-medium align-middle">
                        {item.periodStart} ~ {item.periodEnd}
                      </td>
                      <td className="px-6 py-5 text-center text-slate-900 font-bold align-middle">
                        {item.styleCount} st
                      </td>
                      <td className="px-6 py-5 text-center align-middle">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${item.isOngoing ? "bg-sky-50 text-sky-600" : "bg-slate-100 text-slate-400"}`}
                        >
                          {item.isOngoing ? "진행중" : "종료됨"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center align-middle font-medium text-slate-600">
                        {item.isRandomized ? "랜덤배열" : "정배열"}
                      </td>
                      <td className="px-6 py-5 text-center align-middle">
                        <div className="flex justify-center items-center">
                          <button
                            onClick={() => handleDownloadCsv(item.name)}
                            className="rounded-lg p-2 bg-slate-900 text-white hover:bg-slate-700 shadow-sm flex items-center justify-center"
                          >
                            <FileSpreadsheet size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400 font-medium">
                      등록된 품평 프로젝트가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-center py-6 bg-white border-t border-slate-100 gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`min-w-[40px] h-10 rounded-lg text-sm font-bold transition-all ${currentPage === i + 1 ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminEvaluationPage;
