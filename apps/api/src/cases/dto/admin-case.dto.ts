import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateCaseItemDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsUrl()
  imageUrl!: string;

  @IsPositive()
  weight!: number;

  @IsInt()
  @Min(0)
  valueMinor!: number;

  @IsString()
  @Length(3, 8)
  currency!: string;
}

export class CreateCaseDto {
  @IsString()
  @Length(2, 64)
  slug!: string;

  @IsString()
  @Length(2, 200)
  name!: string;

  @IsInt()
  @Min(1)
  priceMinor!: number;

  @IsString()
  @Length(3, 8)
  currency!: string;

  @IsUrl()
  imageUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCaseItemDto)
  items!: CreateCaseItemDto[];
}
