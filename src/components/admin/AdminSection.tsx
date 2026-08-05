import { Plus, FileUp, Trash2 } from "lucide-react";
import { CARD, TH, TD, ROW, CHECKBOX } from "./adminTable";

export interface Account {
  id: string;
  code: string;
  role: string;
  selected: boolean;
  isNew?: boolean;
}

interface AdminSectionProps {
  title: string;
  data: Account[];
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleItem: (idx: number) => void;
  onChangeId: (idx: number, value: string) => void;
  onChangeCode: (idx: number, value: string) => void;
  onRegister: (idx: number) => void;
  onDeleteSelected: () => void;
  onBulkUpload: () => void;
  onAddRow: () => void;
}

// 계정 섹션(관리자/임직원1/임직원2/매장) 카드.
// ⚠️ 반드시 모듈 최상위에 정의 — 부모 body 안에 두면 매 렌더마다 새 컴포넌트 타입이 되어
//    ID/CODE 입력 중 리마운트로 포커스가 날아감
const AdminSection = ({
  title,
  data,
  allSelected,
  onToggleAll,
  onToggleItem,
  onChangeId,
  onChangeCode,
  onRegister,
  onDeleteSelected,
  onBulkUpload,
  onAddRow,
}: AdminSectionProps) => {
  const selectedCount = data.filter((d) => d.selected && d.id !== "admin").length;

  return (
    <div className="mb-8">
      <div className="mb-3 flex h-8 items-center justify-between px-1">
        <h3 className="text-base font-medium">
          {title} <span className="text-sm tabular-nums text-muted-foreground">{data.length}</span>
        </h3>
        <div className="flex items-center gap-1">
          {/* 삭제는 선택된 계정이 있을 때만 노출 */}
          {selectedCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 size={14} strokeWidth={1.5} /> <span className="tabular-nums">{selectedCount}</span>개 삭제
            </button>
          )}
          <button
            onClick={onBulkUpload}
            title="일괄등록 (CSV)"
            aria-label={`${title} 일괄등록`}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FileUp size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="max-h-[20rem] overflow-y-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            {/* sticky thead는 아래 행이 비치지 않도록 불투명 배경 필수 */}
            <thead className="sticky top-0 z-10 border-b border-border bg-card">
              <tr>
                <th className={`${TH} w-12`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onToggleAll(e.target.checked)}
                    className={`${CHECKBOX} align-middle`}
                  />
                </th>
                <th className={`${TH} w-[45%]`}>ID</th>
                <th className={`${TH} w-40`}>CODE</th>
                <th className={`${TH} w-40`}>권한</th>
                <th className={`${TH} w-24 text-right`} />
              </tr>
            </thead>
            <tbody>
              {data.map((acc, idx) => (
                <tr key={idx} className={ROW}>
                  <td className={TD}>
                    {acc.id !== "admin" && (
                      <input
                        type="checkbox"
                        checked={acc.selected}
                        onChange={() => onToggleItem(idx)}
                        className={`${CHECKBOX} align-middle`}
                      />
                    )}
                  </td>
                  <td className={TD}>
                    <input
                      value={acc.id}
                      onChange={(e) => onChangeId(idx, e.target.value)}
                      placeholder="ID 입력"
                      className="-mx-2 w-full rounded-md bg-transparent px-2 py-1 font-medium transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/60 focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className={TD}>
                    <input
                      value={acc.code}
                      onChange={(e) => onChangeCode(idx, e.target.value)}
                      placeholder="CODE 입력"
                      className="-mx-2 w-full rounded-md bg-transparent px-2 py-1 tabular-nums text-muted-foreground transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/60 focus:bg-background focus:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className={`${TD} text-muted-foreground`}>{acc.role}</td>
                  <td className={`${TD} text-center`}>
                    {acc.isNew && (
                      <button
                        onClick={() => onRegister(idx)}
                        className="text-sm font-medium text-[hsl(var(--eval-blue))] hover:underline"
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
          onClick={onAddRow}
          aria-label={`${title} 계정 추가`}
          className="flex w-full items-center justify-center border-t border-dashed border-border py-3.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <Plus size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default AdminSection;
