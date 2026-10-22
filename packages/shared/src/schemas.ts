import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  // Explicit legal-age attestation captured at signup; real age/identity
  // verification still happens via the KYC module before any withdrawal.
  ageConfirmed: z.literal(true),
  referralCode: z.string().min(3).max(32).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const openCaseSchema = z.object({
  caseId: z.string().uuid(),
  clientSeed: z.string().min(4).max(64).optional(),
});
export type OpenCaseInput = z.infer<typeof openCaseSchema>;

export const rotateSeedSchema = z.object({
  nextClientSeed: z.string().min(4).max(64).optional(),
});
export type RotateSeedInput = z.infer<typeof rotateSeedSchema>;

export const depositSchema = z.object({
  rail: z.enum(["CARD", "CRYPTO", "STEAM_SKIN"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().min(3).max(8),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawalSchema = z.object({
  rail: z.enum(["CARD", "CRYPTO", "STEAM_SKIN"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().min(3).max(8),
  destination: z.string().min(3).max(256), // IBAN / wallet address / steam trade URL
});
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

export const kycSubmitSchema = z.object({
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().date(),
  documentType: z.enum(["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"]),
  documentFrontUrl: z.string().url(),
  documentBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url(),
});
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;
