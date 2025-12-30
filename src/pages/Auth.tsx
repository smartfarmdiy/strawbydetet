import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, Leaf, LogIn, UserPlus, KeyRound, ArrowLeft } from "lucide-react";
import StrawberryIcon from "@/components/ui/StrawberryIcon";
import { z } from "zod";
import { sanitizeAuthError } from "@/lib/authErrors";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "กรุณาใส่อีเมลที่ถูกต้อง" }),
  password: z.string().min(6, { message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { message: "กรุณาใส่ชื่อ-นามสกุล" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "กรุณาใส่อีเมลที่ถูกต้อง" }),
});

type AuthMode = "login" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: sanitizeAuthError(error),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเชื่อมต่อ Google ได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleForgotPassword = async () => {
    setErrors({});
    setIsLoading(true);

    try {
      const result = forgotPasswordSchema.safeParse({ email });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        setIsLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: sanitizeAuthError(error),
          variant: "destructive",
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: "ส่งอีเมลสำเร็จ!",
          description: "กรุณาตรวจสอบอีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "forgot") {
      await handleForgotPassword();
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      if (mode === "login") {
        const result = loginSchema.safeParse({ email, password });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "เข้าสู่ระบบไม่สำเร็จ",
            description: sanitizeAuthError(error),
            variant: "destructive",
          });
        } else {
          toast({
            title: "สำเร็จ!",
            description: "เข้าสู่ระบบสำเร็จแล้ว",
          });
          navigate("/");
        }
      } else {
        const result = signupSchema.safeParse({ email, password, confirmPassword, fullName });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({
            title: "ลงทะเบียนไม่สำเร็จ",
            description: sanitizeAuthError(error),
            variant: "destructive",
          });
        } else {
          toast({
            title: "ลงทะเบียนสำเร็จ!",
            description: "ยินดีต้อนรับเข้าสู่ระบบ",
          });
          navigate("/");
        }
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderForgotPasswordContent = () => {
    if (resetEmailSent) {
      return (
        <div className="text-center py-4">
          <Mail className="w-16 h-16 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">ตรวจสอบอีเมลของคุณ</h3>
          <p className="text-muted-foreground text-sm mb-4">
            เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยัง<br />
            <span className="font-medium text-foreground">{email}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMode("login");
              setResetEmailSent(false);
            }}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับไปหน้าเข้าสู่ระบบ
          </Button>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center justify-center gap-2 mb-6 p-3 bg-primary/10 rounded-lg">
          <KeyRound className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">ลืมรหัสผ่าน</span>
        </div>

        <p className="text-muted-foreground text-sm text-center mb-4">
          กรอกอีเมลของคุณ แล้วเราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              อีเมล
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่งอีเมล...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                ส่งลิงก์รีเซ็ตรหัสผ่าน
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode("login")}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับไปหน้าเข้าสู่ระบบ
          </Button>
        </form>
      </>
    );
  };

  const renderAuthContent = () => (
    <>
      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
            mode === "login"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LogIn className="w-4 h-4" />
          เข้าสู่ระบบ
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
            mode === "signup"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          ลงทะเบียน
        </button>
      </div>

      {/* Google Sign In Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full mb-4"
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        เข้าสู่ระบบด้วย Google
      </Button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">หรือ</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-foreground">
              ชื่อ-นามสกุล
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="กรอกชื่อ-นามสกุล"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground">
            อีเมล
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-foreground">
              รหัสผ่าน
            </Label>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-primary hover:underline"
              >
                ลืมรหัสผ่าน?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground">
              ยืนยันรหัสผ่าน
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังดำเนินการ...
            </>
          ) : mode === "login" ? (
            <>
              <LogIn className="w-4 h-4 mr-2" />
              เข้าสู่ระบบ
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              สร้างบัญชี
            </>
          )}
        </Button>
      </form>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center gap-2 mb-4">
            <StrawberryIcon className="w-12 h-12 animate-float" />
            <Leaf className="w-6 h-6 text-primary animate-float" style={{ animationDelay: "1s" }} />
          </div>
          <h1 className="text-3xl font-bold">
            <span className="gradient-text">Strawberry</span>{" "}
            <span className="text-foreground">Detection</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === "login" && "เข้าสู่ระบบเพื่อใช้งาน"}
            {mode === "signup" && "สร้างบัญชีใหม่"}
            {mode === "forgot" && "รีเซ็ตรหัสผ่าน"}
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-2xl p-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          {mode === "forgot" ? renderForgotPasswordContent() : renderAuthContent()}
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-sm mt-6">
          © 2025 Smart AI Solution Co., Ltd.
        </p>
      </div>
    </div>
  );
};

export default Auth;