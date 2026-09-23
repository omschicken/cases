import { IsOptional, IsString, IsUUID, Length } from "class-validator";

export class OpenCaseDto {
  @IsUUID()
  caseId!: string;

  // Only honored when the user has no active provably-fair seed yet; see
  // CasesService.openCase for why changing it mid-seed is not allowed.
  @IsOptional()
  @IsString()
  @Length(4, 64)
  clientSeed?: string;
}
