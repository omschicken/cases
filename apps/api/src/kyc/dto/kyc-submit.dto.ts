import { IsDateString, IsEnum, IsOptional, IsUrl, Length } from "class-validator";
import { DocumentType } from "@prisma/client";

export class KycSubmitDto {
  @Length(2, 200)
  fullName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsUrl()
  documentFrontUrl!: string;

  @IsOptional()
  @IsUrl()
  documentBackUrl?: string;

  @IsUrl()
  selfieUrl!: string;
}
