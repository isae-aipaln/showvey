import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { db } from "@/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Download } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import AdminSection, { Account } from "@/components/admin/AdminSection";

type SectionType = "admin" | "staff1" | "staff2" | "store";

const AdminAccountPage = () => {
  const { adminRole } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState<SectionType | null>(null);

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

  // AdminSection에 넘길 props 묶음 — 로직은 기존 핸들러를 그대로 호출
  const sectionProps = (
    title: string,
    data: Account[],
    setData: React.Dispatch<React.SetStateAction<Account[]>>,
    type: SectionType,
  ) => ({
    title,
    data,
    allSelected: isAllSelected(data),
    onToggleAll: (checked: boolean) => toggleAll(type, checked),
    onToggleItem: (idx: number) => toggleItem(data, setData, idx),
    onChangeId: (idx: number, value: string) => updateId(data, setData, idx, value),
    onChangeCode: (idx: number, value: string) => updateCode(data, setData, idx, value),
    onRegister: (idx: number) => handleRegister(type, idx),
    onDeleteSelected: () => deleteSelected(type),
    onBulkUpload: () => {
      setActiveUploadType(type);
      fileInputRef.current?.click();
    },
    onAddRow: () => addNewRow(type),
  });

  return (
    <AdminShell
      title="계정관리"
      headerRight={
        // 양식은 섹션과 무관하게 동일하므로 헤더에 1개만 (기존 섹션별 4개 중복 제거)
        <button
          onClick={handleAccountTemplateDownload}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
        >
          <Download size={14} strokeWidth={1.5} /> 양식 다운로드
        </button>
      }
    >
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleBulkUpload} />

      {adminRole === "Master" && <AdminSection {...sectionProps("관리자", admins, setAdmins, "admin")} />}
      <AdminSection {...sectionProps("임직원1", staff1s, setStaff1s, "staff1")} />
      <AdminSection {...sectionProps("임직원2", staff2s, setStaff2s, "staff2")} />
      <AdminSection {...sectionProps("매장", stores, setStores, "store")} />
    </AdminShell>
  );
};

export default AdminAccountPage;
