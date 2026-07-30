interface EvalRowProps {
  label: string;
  options: string[];
  selected: string | undefined;
  onSelect: (val: string) => void;
  hasError?: boolean;
}

// 라벨 + 알약(3지선다) 버튼 행 — 상세 페이지와 모바일 평가 바텀시트에서 공유
const EvalRow = ({ label, options, selected, onSelect, hasError }: EvalRowProps) => (
  <div className="flex items-center gap-2">
    <span
      className={`w-16 shrink-0 text-xs font-medium transition-colors ${hasError ? "text-destructive" : "text-foreground"}`}
    >
      {label}
    </span>
    <div className="flex flex-1 gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors ${
            selected === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-foreground bg-background text-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

export default EvalRow;
