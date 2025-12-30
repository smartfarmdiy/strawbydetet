/**
 * Sanitizes authentication error messages to prevent information leakage.
 * Maps known error patterns to user-friendly Thai messages.
 */
export const sanitizeAuthError = (error: Error | { message: string }): string => {
  const knownErrors: Record<string, string> = {
    'Invalid login': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'already registered': 'อีเมลนี้ถูกใช้งานแล้ว',
    'Email not confirmed': 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ',
    'User not found': 'ไม่พบบัญชีผู้ใช้',
    'Invalid email': 'รูปแบบอีเมลไม่ถูกต้อง',
    'Password should': 'รหัสผ่านไม่ตรงตามเงื่อนไข',
    'rate limit': 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่',
    'email rate limit': 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่',
    'New password should be different': 'รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านเดิม',
    'same_password': 'รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านเดิม',
  };

  const errorMessage = error.message || '';

  for (const [key, message] of Object.entries(knownErrors)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }

  // Log full error for debugging but don't expose to user
  console.error('Auth error:', errorMessage);
  
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
};
