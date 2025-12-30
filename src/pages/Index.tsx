import { useState, useCallback, useRef } from "react";
import { Leaf, AlertCircle, CheckCircle2 } from "lucide-react";
import StrawberryIcon from "@/components/ui/StrawberryIcon";
import UploadZone from "@/components/UploadZone";
import ResultDisplay from "@/components/ResultDisplay";
import DetectionStats from "@/components/DetectionStats";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const CLASS_NAMES = [
  "Anthracnose Fruit Rot",
  "Gray Mold",
  "Powdery Mildew Fruit",
  "Powdery Mildew Leaf",
  "Ripe",
  "Unripe",
  "Rotten",
];

const initialPercentages = CLASS_NAMES.reduce(
  (acc, name) => ({ ...acc, [name]: 0 }),
  {} as Record<string, number>
);

// Allowed file types and size limits
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

// Request timeout and rate limiting
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const UPLOAD_DEBOUNCE_MS = 1000; // 1 second debounce between uploads

// Fetch with timeout wrapper
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง');
    }
    throw error;
  }
};

const Index = () => {
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("พร้อมใช้งาน");
  const [imageSrc, setImageSrc] = useState<string>("");
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [percentages, setPercentages] = useState(initialPercentages);
  const [hasResults, setHasResults] = useState(false);
  
  // Rate limiting refs
  const lastUploadTime = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get authorization headers
  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Check rate limit
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastUploadTime.current < UPLOAD_DEBOUNCE_MS) {
      toast({
        title: "กรุณารอสักครู่",
        description: "โปรดรอก่อนอัปโหลดไฟล์ใหม่",
        variant: "destructive",
      });
      return false;
    }
    lastUploadTime.current = now;
    return true;
  }, [toast]);

  // Handle auth errors specifically
  const handleAuthError = useCallback((response: Response) => {
    if (response.status === 401 || response.status === 403) {
      toast({
        title: "การยืนยันตัวตนล้มเหลว",
        description: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
        variant: "destructive",
      });
      return true;
    }
    return false;
  }, [toast]);

  // Validate file type and size
  const validateFile = useCallback(
    (file: File, allowedTypes: string[], maxSize: number): string | null => {
      if (!allowedTypes.includes(file.type)) {
        return `ประเภทไฟล์ไม่รองรับ กรุณาใช้ไฟล์ ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`;
      }
      if (file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        return `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${maxSizeMB}MB)`;
      }
      // Sanitize filename check - reject suspicious patterns
      if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name) || file.name.includes('..')) {
        return "ชื่อไฟล์ไม่ถูกต้อง";
      }
      return null;
    },
    []
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      // Rate limit check
      if (!checkRateLimit()) return;

      // Validate file before upload
      const validationError = validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
      if (validationError) {
        toast({
          title: "ไฟล์ไม่ถูกต้อง",
          description: validationError,
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);
      setStatus("กำลังอัปโหลดภาพ...");
      setImageSrc("");
      setVideoSrc("");

      const formData = new FormData();
      formData.append("image", file);

      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetchWithTimeout(`${API_BASE_URL}/upload_image`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });

        // Handle auth errors
        if (handleAuthError(response)) {
          setIsProcessing(false);
          setStatus("เกิดข้อผิดพลาด");
          return;
        }

        const data = await response.json();

        if (response.ok && !data.error) {
          setStatus("ประมวลผลภาพสำเร็จ");
          setImageSrc(`${API_BASE_URL}${data.image_url}`);
          setPercentages(data.percentages);
          setHasResults(true);
          toast({
            title: "สำเร็จ!",
            description: "ตรวจจับสภาพสตรอว์เบอร์รี่เรียบร้อยแล้ว",
          });
        } else {
          throw new Error(data.error || "เกิดข้อผิดพลาด");
        }
      } catch (error) {
        setStatus("เกิดข้อผิดพลาด");
        toast({
          title: "ข้อผิดพลาด",
          description: error instanceof Error ? error.message : "ไม่สามารถอัปโหลดภาพได้",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast, validateFile, getAuthHeaders, checkRateLimit, handleAuthError]
  );

  const handleVideoUpload = useCallback(
    async (file: File) => {
      // Rate limit check
      if (!checkRateLimit()) return;

      // Validate file before upload
      const validationError = validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE);
      if (validationError) {
        toast({
          title: "ไฟล์ไม่ถูกต้อง",
          description: validationError,
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);
      setStatus("กำลังอัปโหลดวิดีโอ...");
      setImageSrc("");
      setVideoSrc("");

      const formData = new FormData();
      formData.append("video", file);

      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetchWithTimeout(`${API_BASE_URL}/upload_video`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        }, 60000); // 60 second timeout for video uploads

        // Handle auth errors
        if (handleAuthError(response)) {
          setIsProcessing(false);
          setStatus("เกิดข้อผิดพลาด");
          return;
        }

        if (response.ok) {
          setStatus("กำลังประมวลผลวิดีโอ...");
          setVideoSrc(`${API_BASE_URL}/video_feed?${Date.now()}`);
          setHasResults(true);

          // Clear any existing poll interval
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }

          // Start polling for detection counts
          pollIntervalRef.current = setInterval(async () => {
            try {
              const pollAuthHeaders = await getAuthHeaders();
              const countsRes = await fetchWithTimeout(`${API_BASE_URL}/detection_counts`, {
                headers: pollAuthHeaders,
              }, 5000);
              
              if (handleAuthError(countsRes)) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setIsProcessing(false);
                return;
              }
              
              const counts = await countsRes.json();
              setPercentages(counts);

              const finalRes = await fetchWithTimeout(`${API_BASE_URL}/final_counts`, {
                headers: pollAuthHeaders,
              }, 5000);
              
              const finalData = await finalRes.json();

              if (finalData.complete) {
                setPercentages(finalData.percentages);
                setStatus("ประมวลผลวิดีโอสำเร็จ");
                setIsProcessing(false);
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                toast({
                  title: "สำเร็จ!",
                  description: "ประมวลผลวิดีโอเรียบร้อยแล้ว",
                });
              }
            } catch (e) {
              // Silently handle polling errors
            }
          }, 500);
        } else {
          throw new Error("ไม่สามารถอัปโหลดวิดีโอได้");
        }
      } catch (error) {
        setStatus("เกิดข้อผิดพลาด");
        setIsProcessing(false);
        toast({
          title: "ข้อผิดพลาด",
          description: error instanceof Error ? error.message : "ไม่สามารถอัปโหลดวิดีโอได้",
          variant: "destructive",
        });
      }
    },
    [toast, validateFile, getAuthHeaders, checkRateLimit, handleAuthError]
  );

  const handleCameraStart = useCallback(() => {
    toast({
      title: "ฟีเจอร์กล้อง",
      description: "กรุณาใช้งานผ่าน Flask backend โดยตรง",
    });
  }, [toast]);

  const handleClear = useCallback(async () => {
    // Clear any polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      const authHeaders = await getAuthHeaders();
      await fetchWithTimeout(`${API_BASE_URL}/stop_stream`, { 
        method: "POST",
        headers: authHeaders,
      }, 5000);
    } catch (e) {
      // Silently handle stop stream errors
    }

    setImageSrc("");
    setVideoSrc("");
    setPercentages(initialPercentages);
    setStatus("พร้อมใช้งาน");
    setIsProcessing(false);
    setHasResults(false);
  }, [getAuthHeaders]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12 animate-slide-up relative">
          {/* User Menu - positioned top right */}
          <div className="absolute right-0 top-0">
            <UserMenu />
          </div>
          
          <div className="inline-flex items-center gap-3 mb-4">
            <StrawberryIcon className="w-14 h-14 animate-float" />
            <Leaf className="w-8 h-8 text-primary animate-float" style={{ animationDelay: "1s" }} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="gradient-text">Strawberry</span>{" "}
            <span className="text-foreground">Detection</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            ระบบตรวจจับสภาพสตรอว์เบอร์รี่อัจฉริยะด้วย AI
            <br />
            <span className="text-sm">โดย Smart AI Solution Co., Ltd.</span>
          </p>
        </header>

        {/* Status Bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isProcessing
                ? "bg-warning/20 text-warning"
                : hasResults
                ? "bg-success/20 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isProcessing ? (
              <AlertCircle className="w-4 h-4 animate-pulse-soft" />
            ) : hasResults ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : null}
            {status}
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          <UploadZone
            onImageUpload={handleImageUpload}
            onVideoUpload={handleVideoUpload}
            onCameraStart={handleCameraStart}
            isProcessing={isProcessing}
          />

          <ResultDisplay
            imageSrc={imageSrc}
            videoSrc={videoSrc}
            isProcessing={isProcessing}
            status={status}
            onClear={handleClear}
          />

          {hasResults && (
            <>
              <DetectionStats percentages={percentages} showChart={true} />
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
                >
                  ล้างผลลัพธ์
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-muted-foreground text-sm">
          <p>© 2025 Smart AI Solution Co., Ltd. All rights reserved.</p>
          <p className="mt-1">
            Powered by YOLO Object Detection
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;