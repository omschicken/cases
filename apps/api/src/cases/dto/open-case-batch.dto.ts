import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";

/** A single atomic paid operation of up to five cases. */
export class OpenCaseBatchDto {
  @IsUUID()
  caseId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  count!: number;

  @IsOptional()
  @IsString()
  @Length(4, 64)
  clientSeed?: string;
}
