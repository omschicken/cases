// Explicit named re-exports (not `export *`) — esbuild/Vite's CJS→ESM
// interop can't statically detect named exports funneled through a dynamic
// `export *` loop in the compiled CJS output, which silently broke any
// newly-added named import from this package in the web app's dev server.
export type { WeightedItem, RollResult, VerifyInput, VerifyResult } from "./provablyFair";
export {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  computeRoll,
  ProvablyFairError,
  pickWeightedItem,
  rollCase,
  verifyRoll,
} from "./provablyFair";

export type { MinorUnits } from "./money";
export { toMinorUnits, fromMinorUnits, formatMinorUnits } from "./money";

export type {
  UserRole,
  KycStatus,
  LedgerReason,
  PaymentRail,
  ItemRarity,
  DepositStatus,
  WithdrawalStatus,
  CaseItemDto,
  CaseDto,
  OpenCaseResultDto,
  RevealedSeedDto,
} from "./types";

export type {
  RegisterInput,
  LoginInput,
  OpenCaseInput,
  RotateSeedInput,
  DepositInput,
  WithdrawalInput,
  KycSubmitInput,
} from "./schemas";
export {
  registerSchema,
  loginSchema,
  openCaseSchema,
  rotateSeedSchema,
  depositSchema,
  withdrawalSchema,
  kycSubmitSchema,
} from "./schemas";
