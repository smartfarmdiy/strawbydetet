import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultDisplayProps {
  imageSrc?: string;
  videoSrc?: string;
  isProcessing: boolean;
  status: string;
  onClear: () => void;
}

const ResultDisplay = ({
  imageSrc,
  videoSrc,
  isProcessing,
  status,
  onClear,
}: ResultDisplayProps) => {
  if (!imageSrc && !videoSrc && !isProcessing) return null;

  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {isProcessing && (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          )}
          <span className="font-medium text-foreground">{status}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="text-muted-foreground hover:text-secondary"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="relative bg-foreground/5 aspect-video flex items-center justify-center">
        {isProcessing && !imageSrc && !videoSrc ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-muted-foreground">กำลังประมวลผล...</p>
          </div>
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt="Detection Result"
            className="w-full h-full object-contain"
          />
        ) : videoSrc ? (
          <img
            src={videoSrc}
            alt="Video Stream"
            className="w-full h-full object-contain"
          />
        ) : null}
      </div>
    </div>
  );
};

export default ResultDisplay;