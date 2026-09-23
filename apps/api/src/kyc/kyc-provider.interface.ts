export const KYC_PROVIDER = Symbol("KYC_PROVIDER");

export interface KycSubmissionInput {
  fullName: string;
  dateOfBirth: string; // ISO date
  documentType: "PASSPORT" | "NATIONAL_ID" | "DRIVERS_LICENSE";
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfieUrl: string;
}

export interface KycProviderResult {
  providerRef: string;
  /** Whether the provider itself renders an automatic decision, or leaves it PENDING for human review. */
  autoStatus: "PENDING" | "VERIFIED" | "REJECTED";
  reason?: string;
}

/**
 * Swap the mock binding in KycModule for a real identity-verification
 * provider (Sumsub, Veriff, Onfido, etc.) once the licensed entity has a
 * contract in place. Nothing outside this interface needs to change.
 */
export interface KycProvider {
  submit(input: KycSubmissionInput): Promise<KycProviderResult>;
}
