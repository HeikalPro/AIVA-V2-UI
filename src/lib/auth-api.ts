import { apiPost } from "@/lib/api-client";

const VERIFY_EMAIL_KEY = "aiva_verify_email";

export function setVerifyEmail(email: string): void {
  sessionStorage.setItem(VERIFY_EMAIL_KEY, email);
}

export function getVerifyEmail(): string {
  return sessionStorage.getItem(VERIFY_EMAIL_KEY) ?? "";
}

export function clearVerifyEmail(): void {
  sessionStorage.removeItem(VERIFY_EMAIL_KEY);
}

type MessageResponse = { message: string };

export async function signup(payload: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<MessageResponse> {
  return apiPost<MessageResponse>("/api/auth/signup", payload, false);
}

export async function verifyEmailOtp(email: string, otp: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>("/api/auth/verify-email-otp", { email, otp }, false);
}

export async function resendEmailOtp(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>("/api/auth/resend-email-otp", { email }, false);
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>("/api/auth/forgot-password", { email }, false);
}

export async function resetPassword(payload: {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}): Promise<MessageResponse> {
  return apiPost<MessageResponse>("/api/auth/reset-password", payload, false);
}
