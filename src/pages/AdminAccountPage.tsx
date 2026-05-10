import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { db } from "@/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Menu, Home, Lock, Shirt, LogOut, Bell, Plus, FileUp, Download } from "lucide-react";
import { toast } from "sonner";

interface Account {
  id: string;
  code: string;
  role: string;
  selected: boolean;
  isNew?: boolean;
}

type SectionType = "admin" | "staff1" | "staff2" | "store";

const AdminAccountPage = () => {
  const { logout, adminRole } = useAppContext();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState<SectionType | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [admins, setAdmins] = useState<Account[]>([]);
  const [staff1s, setStaff1s] = useState<Account[]>([]);
  const [staff2s, setStaff2s] = useState<Account[]>([]);
  const [stores, setStores] = useState<Account[]>([]);



  const getDefaultRole = (type: SectionType) => {
    switch (type) {
      case "admin": return "Sub Master";
      case "staff1": return "Staff1";
      case "staff2": return "Staff2";
      case "store": return "Store";
    }
  };

  const fetchAccounts = async () => {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        code: doc.data().code || "0000",
        role: doc.data().role || "",
        selected: false,
      }));

      // Sort by ID ascending
      allUsers.sort((a, b) => a.id.localeCompare(b.id));

      setAdmins(allUsers.filter(u => u.role === "Master" || u.role === "Sub Master"));
      setStaff1s(allUsers.filter(u => u.role === "Staff1"));
      setStaff2s(allUsers.filter(u => u.role === "Staff2"));
      setStores(allUsers.filter(u => u.role === "Store"));
    } catch (error: any) {
      console.error("데이터 로드 실패:", error.message);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleRegister = async (type: SectionType, idx: number) => {
    const data = type === "admin" ? admins : type === "staff1" ? staff1s : type === "staff2" ? staff2s : stores;
    const account = data[idx];

    if (!account.id.trim()) return toast.error("ID를 입력해주세요.");

    try {
      const userRef = doc(db, "users", account.id);
      await setDoc(userRef, { code: account.code, role: account.role }, { merge: true });

      toast.success(`${account.id} 등록 완료`);
      fetchAccounts();
    } catch (error: any) {
      toast.error(`등록 실패: ${error.message}`);
    }
  };

  const deleteSelected = async (type: SectionType) => {
    const data = type === "admin" ? admins : type === "staff1" ? staff1s : type === "staff2" ? staff2s : stores;
    const selectedIds = data.filter((a) => a.selected).map((a) => a.id);

    if (selectedIds.length === 0) return toast.error("삭제할 계정을 선택해주세요.");

    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.delete(doc(db, "users", id));
      });
      await batch.commit();
      
      toast.success("선택된 계정이 삭제되었습니다.");
      fetchAccounts();
    } catch (error: any) {
      toast.error(`삭제 실패: ${error.message}`);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadType) return;

    const role = getDefaultRole(activeUploadType);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        let text = "";

        try {
          const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
          text = utf8Decoder.decode(buffer);
        } catch (err) {
          const eucKrDecoder = new TextDecoder("euc-kr");
          text = eucKrDecoder.decode(buffer);
        }

        text = text.replace(/^\uFEFF/, "");
        const rows = text.split(/\r?\n/).filter((row) => row.trim() !== "");
        if (rows.length <= 1) return toast.error("파일에 데이터가 없습니다.");

        const dataRows = rows.slice(1);
        const uploadData = dataRows
          .map((row) => {
            const columns = row.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
            return { ID: columns[0], Code: columns[1] || "0000", Role: role };
          })
          .filter((d) => d.ID);

        const batch = writeBatch(db);
        uploadData.forEach((d) => {
          batch.set(doc(db, "users", d.ID), { code: d.Code, role: d.Role }, { merge: true });
        });
        await batch.commit();

        toast.success(`${uploadData.length}개의 계정이 성공적으로 등록되었습니다.`);
        fetchAccounts();
      } catch (err: any) {
        console.error("CSV 상세 에러:", err);
        toast.error(`등록 실패: ${err.message || "파일 형식을 확인해주세요."}`);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleAccountTemplateDownload = () => {
    const headers = ["ID", "Code", "Role"];
    const csvContent = "\uFEFF" + headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "계정_업로드_양식.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleAll = (type: SectionType, checked: boolean) => {
    if (type === "admin") setAdmins(admins.map((a) => ({ ...a, selected: a.id === "admin" ? false : checked })));
    if (type === "staff1") setStaff1s(staff1s.map((s) => ({ ...s, selected: checked })));
    if (type === "staff2") setStaff2s(staff2s.map((s) => ({ ...s, selected: checked })));
    if (type === "store") setStores(stores.map((s) => ({ ...s, selected: checked })));
  };

  const addNewRow = (type: SectionType) => {
    const newAcc: Account = {
      id: "",
      code: "",
      role: getDefaultRole(type),
      selected: false,
      isNew: true,
    };
    if (type === "admin") setAdmins([...admins, newAcc]);
    if (type === "staff1") setStaff1s([...staff1s, newAcc]);
    if (type === "staff2") setStaff2s([...staff2s, newAcc]);
    if (type === "store") setStores([...stores, newAcc]);
  };

  const toggleItem = (data: Account[], setData: React.Dispatch<React.SetStateAction<Account[]>>, idx: number) => {
    const newData = [...data];
    newData[idx].selected = !newData[idx].selected;
    setData(newData);
  };

  const updateId = (
    data: Account[],
    setData: React.Dispatch<React.SetStateAction<Account[]>>,
    idx: number,
    value: string,
  ) => {
    const newData = [...data];
    newData[idx].id = value;
    setData(newData);
  };

  const updateCode = (
    data: Account[],
    setData: React.Dispatch<React.SetStateAction<Account[]>>,
    idx: number,
    value: string,
  ) => {
    const newData = [...data];
    newData[idx].code = value;
    setData(newData);
  };

  const isAllSelected = (data: Account[]) => {
    const deletableAccounts = data.filter((d) => d.id !== "admin");
    return deletableAccounts.length > 0 && deletableAccounts.every((d) => d.selected);
  };

  const renderSection = (
    title: string,
    data: Account[],
    setData: React.Dispatch<React.SetStateAction<Account[]>>,
    type: SectionType,
  ) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-base font-bold text-slate-700">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => deleteSelected(type)}
            className="rounded bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-all min-w-[64px] flex items-center justify-center"
          >
            삭제
          </button>
          <button
            onClick={() => {
              setActiveUploadType(type);
              fileInputRef.current?.click();
            }}
            className="rounded bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-all flex items-center gap-1 justify-center"
          >
            <FileUp size={14} /> 일괄등록
          </button>
          <button
            onClick={handleAccountTemplateDownload}
            className="rounded bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-all flex items-center gap-1 justify-center"
          >
            <Download size={14} /> 양식 다운로드
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
              <tr>
                <th className="w-12 px-6 py-4 text-left align-middle">
                  <input
                    type="checkbox"
                    checked={isAllSelected(data)}
                    onChange={(e) => toggleAll(type, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-slate-900 align-middle"
                  />
                </th>
                <th className="w-[45%] px-6 py-4 text-left font-bold text-slate-700 uppercase tracking-tight align-middle">
                  ID
                </th>
                <th className="w-40 px-6 py-4 text-left font-bold text-slate-700 uppercase tracking-tight align-middle">
                  CODE
                </th>
                <th className="w-40 px-6 py-4 text-left font-bold text-slate-700 uppercase tracking-tight align-middle">
                  권한
                </th>
                <th className="w-24 px-6 py-4 text-right align-middle"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((acc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 align-middle">
                    {acc.id !== "admin" && (
                      <input
                        type="checkbox"
                        checked={acc.selected}
                        onChange={() => toggleItem(data, setData, idx)}
                        className="h-4 w-4 rounded border-slate-300 accent-slate-900 align-middle"
                      />
                    )}
                  </td>
                  <td className="px-6 py-3.5 align-middle">
                    <input
                      value={acc.id}
                      onChange={(e) => updateId(data, setData, idx, e.target.value)}
                      placeholder="ID 입력"
                      className="bg-transparent text-slate-700 underline underline-offset-4 decoration-slate-200 focus:outline-none focus:text-blue-600 w-full font-medium"
                    />
                  </td>
                  <td className="px-6 py-3.5 align-middle">
                    <input
                      value={acc.code}
                      onChange={(e) => updateCode(data, setData, idx, e.target.value)}
                      placeholder="CODE 입력"
                      className="bg-transparent text-slate-600 focus:outline-none w-full"
                    />
                  </td>
                  <td className="px-6 py-3.5 text-slate-500 font-medium align-middle">{acc.role}</td>
                  <td className="px-6 py-3.5 text-center">
                    {acc.isNew && (
                      <button
                        onClick={() => handleRegister(type, idx)}
                        className="text-blue-600 font-bold hover:underline"
                      >
                        등록
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => addNewRow(type)}
          className="flex w-full items-center justify-center border-t border-dashed border-slate-200 py-4 text-slate-400 hover:bg-slate-50 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );

  const handleLogout = () => {
    logout();
    toast.success("로그아웃 되었습니다.");
    navigate("/");
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans antialiased text-slate-900 transition-all duration-300">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleBulkUpload} />

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
              className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-medium transition-colors"
            >
              <Lock size={18} className="shrink-0" />
              {isSidebarOpen && <span>계정관리</span>}
            </button>
            <button
              onClick={() => navigate("/admin/evaluations")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Shirt size={18} className="shrink-0" />
              {isSidebarOpen && <span>품평관리</span>}
            </button>
          </nav>
        </div>
        <div className="mb-4 flex flex-col gap-1 px-2 border-t border-slate-700 pt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            {isSidebarOpen && <span>로그아웃</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm z-10">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">계정관리</h2>
          <button className="relative rounded-full p-2 hover:bg-slate-100 transition-colors">
            <Bell size={20} className="text-slate-600" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          {adminRole === "Master" && renderSection("관리자", admins, setAdmins, "admin")}
          {renderSection("임직원1", staff1s, setStaff1s, "staff1")}
          {renderSection("임직원2", staff2s, setStaff2s, "staff2")}
          {renderSection("매장", stores, setStores, "store")}
        </main>
      </div>
    </div>
  );
};

export default AdminAccountPage;
