import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import LoginPage from "./pages/LoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import GalleryPage from "./pages/GalleryPage";
import GuestProductDetail from "./pages/GuestProductDetail";
import StaffProductDetail from "./pages/StaffProductDetail";
import CoordiPage from "./pages/CoordiPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAccountPage from "./pages/AdminAccountPage";
import AdminEvaluationPage from "./pages/AdminEvaluationPage";
import AdminEvaluationDetailPage from "./pages/AdminEvaluationDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner
          position="top-center"
          closeButton
          toastOptions={{
            className:
              "!bg-white/60 !backdrop-blur-lg !border !border-white/40 !shadow-xl !text-black !rounded-2xl relative !pr-10",
            classNames: {
              closeButton: "!left-auto !right-3 !top-1/2 !-translate-y-1/2 !absolute !bg-transparent !border-none",
            },
          }}
        />
        <BrowserRouter>
          <Routes>
            {/* 1. 메인 로그인 및 관리자 전용 로그인 */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />

            {/* 2. 관리자 전용 페이지 그룹 */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/accounts" element={<AdminAccountPage />} />
            <Route path="/admin/evaluations" element={<AdminEvaluationPage />} />

            {/* ⭐ 수정된 경로: ID 파라미터를 사용하여 신규(new)와 기존 품평을 구분 */}
            <Route path="/admin/evaluations/:id" element={<AdminEvaluationDetailPage />} />

            {/* 3. 직원 및 게스트용 공통 갤러리 */}
            <Route path="/gallery" element={<GalleryPage />} />

            {/* 4. 상품 상세 및 코디 페이지 (파라미터 :styleCode 사용) */}
            <Route path="/guest-product/:styleCode" element={<GuestProductDetail />} />
            <Route path="/staff-product/:styleCode" element={<StaffProductDetail />} />
            <Route path="/coordi/:styleCode" element={<CoordiPage />} />

            {/* 5. 404 페이지 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
