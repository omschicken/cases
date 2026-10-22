import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { KycProvider, KycProviderResult, KycSubmissionInput } from "../kyc-provider.interface";

/**
 * Development-only stand-in. Never auto-verifies — every submission lands
 * as PENDING so a human admin reviews it in the admin panel, mirroring how a
 * real provider's manual-review queue behaves.
 */
@Injectable()
export class MockKycProvider implements KycProvider {
  async submit(_input: KycSubmissionInput): Promise<KycProviderResult> {
    return { providerRef: `mock_${randomUUID()}`, autoStatus: "PENDING" };
  }
}
