import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExit: () => void;
}

// 2단계 종료 다이얼로그(확인 → 감사 인사) — GalleryPage의 나가기 팝업과 동일 UX (모바일 셸 전용 복제본)
const ExitDialog = ({ open, onOpenChange, onExit }: ExitDialogProps) => {
  const [step, setStep] = useState<"confirm" | "thanks">("confirm");

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStep("confirm");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-w-xs flex-col items-center gap-6 rounded-2xl p-8">
        {step === "confirm" ? (
          <>
            <p className="text-center text-sm font-medium">앱을 종료하시겠습니까?</p>
            <div className="flex w-full gap-2">
              <button
                onClick={() => setStep("thanks")}
                className="flex-1 rounded-full border border-foreground bg-background py-3 text-sm font-medium text-foreground"
              >
                확인
              </button>
              <button
                onClick={() => handleOpenChange(false)}
                className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
              >
                취소
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-sm font-medium">감사합니다.</p>
            <button
              onClick={onExit}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
            >
              확인
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExitDialog;
