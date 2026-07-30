interface SegmentedControlProps {
  options: string[];
  value: string | undefined;
  onChange: (val: string) => void;
}

// iOS UISegmentedControl 스타일: 회색 트랙 안에서 선택 항목만 흰색으로 떠오름 (모바일 평가 시트용)
const SegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => (
  <div className="flex rounded-lg bg-muted p-0.5">
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={`flex-1 rounded-md py-1.5 text-xs transition-[background-color,box-shadow] ${
          value === opt ? "bg-white font-medium text-foreground shadow-sm" : "text-muted-foreground"
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

export default SegmentedControl;
