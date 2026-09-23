import { IsOptional, IsString, Length } from "class-validator";

export class RotateSeedDto {
  @IsOptional()
  @IsString()
  @Length(4, 64)
  nextClientSeed?: string;
}
