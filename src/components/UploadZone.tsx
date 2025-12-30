import { Upload, Image, Video, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface UploadZoneProps {
  onImageUpload: (file: File) => void;
  onVideoUpload: (file: File) => void;
  onCameraStart: () => void;
  isProcessing: boolean;
}

const UploadZone = ({
  onImageUpload,
  onVideoUpload,
  onCameraStart,
  isProcessing,
}: UploadZoneProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageUpload(file);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onVideoUpload(file);
  };

  return (
    <div className="glass-card rounded-2xl p-8 animate-slide-up">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-glow">
          <Upload className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          อัปโหลดไฟล์เพื่อตรวจสอบ
        </h2>
        <p className="text-muted-foreground text-sm">
          รองรับไฟล์ภาพ (JPG, PNG) และวิดีโอ (MP4, AVI)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => imageInputRef.current?.click()}
          disabled={isProcessing}
        >
          <Image className="w-8 h-8 text-primary" />
          <span className="text-sm font-medium">อัปโหลดภาพ</span>
        </Button>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/avi"
          onChange={handleVideoChange}
          className="hidden"
        />
        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-2 border-dashed border-secondary/30 hover:border-secondary hover:bg-secondary/5 transition-all"
          onClick={() => videoInputRef.current?.click()}
          disabled={isProcessing}
        >
          <Video className="w-8 h-8 text-secondary" />
          <span className="text-sm font-medium">อัปโหลดวิดีโอ</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-2 border-dashed border-info/30 hover:border-info hover:bg-info/5 transition-all"
          onClick={onCameraStart}
          disabled={isProcessing}
        >
          <Camera className="w-8 h-8 text-info" />
          <span className="text-sm font-medium">เปิดกล้อง</span>
        </Button>
      </div>
    </div>
  );
};

export default UploadZone;