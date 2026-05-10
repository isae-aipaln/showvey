import React, { createContext, useContext, useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { db } from "@/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { toast } from "sonner";

// ⭐ 1. 설계도(Interface)의 규격을 리액트 실제 데이터 타입과 100% 일치시켰습니다.
interface AppContextType {
  userId: string | null;
  userRole: string | null;
  adminRole: "Master" | "sub_master" | null;
  currentProjectId: string | null;
  projects: any[];
  products: any[];
  evaluations: any[];
  isRandomized: boolean;
  setUserRole: Dispatch<SetStateAction<any>>;
  setAdminRole: Dispatch<SetStateAction<any>>;
  setCurrentProjectId: Dispatch<SetStateAction<string | null>>;
  login: (id: string, role: any, aRole?: any) => void; // email -> id로 명칭 통일
  logout: () => void;
  refreshData: () => Promise<void>;
  updateEvaluation: (evalData: any) => void;
  markProductEvaluated: (productId: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(localStorage.getItem("currentUser"));
  const [userRole, setUserRole] = useState<any>(localStorage.getItem("userRole"));
  const [adminRole, setAdminRole] = useState<any>(localStorage.getItem("adminRole"));
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [isRandomized, setIsRandomized] = useState(false);

  // 준수님의 기존 로직 100% 유지
  // Firebase Firestore 로직으로 교체
  const refreshData = useCallback(async () => {
    try {
      // 1. 활성화된 프로젝트 로드
      const projectsRef = collection(db, "projects");
      const qProjects = query(projectsRef, where("Status", "==", true));
      const projectSnapshot = await getDocs(qProjects);
      const allProjects = projectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (allProjects.length === 0) {
        setProducts([]);
        setProjects([]);
        setIsRandomized(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filteredProjects = allProjects.filter((project: any) => {
        if (!project.Period) return false;
        const [startStr, endStr] = project.Period.split(" ~ ");
        const startDate = new Date(startStr.replace(/\./g, "/"));
        const endDate = new Date(endStr.replace(/\./g, "/"));
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return today >= startDate && today <= endDate;
      });

      // 문서 ID(Project_name) 기준
      const activeProjectNames = filteredProjects.map((p: any) => p.id);
      setProjects(activeProjectNames);

      const hasRandomOption = filteredProjects.some((p: any) => p.Arrangement === "랜덤배열");
      setIsRandomized(hasRandomOption);

      if (activeProjectNames.length === 0) {
        setProducts([]);
        return;
      }

      // 2. 활성화된 프로젝트들의 상품 로드
      const productsRef = collection(db, "products");
      const qProducts = query(
        productsRef,
        where("Project_name", "in", activeProjectNames),
        orderBy("sort_order", "asc")
      );
      const productSnapshot = await getDocs(qProducts);
      const productData = productSnapshot.docs.map(doc => ({ Style_no: doc.id, ...doc.data() }));

      if (productData) {
        let formattedProducts = productData.map((item: any) => ({
          id: item.Style_no,
          styleCode: item.Style_no,
          thumbnailImage: item.Thumbnail_url || "",
          name: item.Style_no,
          price: item.Sale_price,
          productImages: item.Product_image_urls || [],
          coordiImages: item.Coord_image_urls || [],
          projectId: item.Project_name,
        }));

        if (userRole !== "ADMIN" && hasRandomOption) {
          formattedProducts = [...formattedProducts].sort(() => Math.random() - 0.5);
        }
        setProducts(formattedProducts);
      }

      // 3. 현재 로그인된 유저의 평가 데이터만 로드 (단일 evaluations 컬렉션)
      const currentUser = localStorage.getItem("currentUser");
      if (currentUser) {
        const evalsRef = collection(db, "evaluations");
        const qEvals = query(evalsRef, where("Evaluator_ID", "==", currentUser));
        const evalSnapshot = await getDocs(qEvals);
        const evalData = evalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEvaluations(evalData);
      } else {
        setEvaluations([]);
      }
    } catch (err) {
      console.error("Data refresh error:", err);
    }
  }, [userRole]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ⭐ Interface와 명칭(id)을 통일했습니다.
  const login = (id: string, role: any, aRole: any = null) => {
    localStorage.setItem("currentUser", id);
    localStorage.setItem("userRole", role);
    if (aRole) localStorage.setItem("adminRole", aRole);
    setUserId(id);
    setUserRole(role);
    setAdminRole(aRole);
  };

  const logout = () => {
    localStorage.clear();
    setUserId(null);
    setUserRole(null);
    setAdminRole(null);
    setCurrentProjectId(null);
    // ⭐ 다른 계정 데이터 혼선 방지를 위한 완벽한 상태 초기화
    setProducts([]);
    setProjects([]);
    setEvaluations([]);
    setIsRandomized(false);
  };

  const updateEvaluation = (evalData: any) => {
    setEvaluations((prev) => {
      const filtered = prev.filter(
        (e) => !(e.Style_no === evalData.Style_no && e.Evaluator_ID === evalData.Evaluator_ID),
      );
      return [...filtered, evalData];
    });
  };

  const markProductEvaluated = (productId: any) => {
    console.log(`Product ${productId} evaluated`);
  };

  return (
    <AppContext.Provider
      value={{
        userId,
        userRole,
        adminRole,
        currentProjectId,
        projects,
        products,
        evaluations,
        isRandomized,
        setUserRole,
        setAdminRole,
        setCurrentProjectId,
        login,
        logout,
        refreshData,
        updateEvaluation,
        markProductEvaluated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
