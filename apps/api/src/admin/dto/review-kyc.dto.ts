import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class ReviewKycDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  rejectionReason?: string;
}
