import { IsEnum, IsInt, IsString, Length, Min } from "class-validator";
import { PaymentRail } from "@prisma/client";

export class DepositDto {
  @IsEnum(PaymentRail)
  rail!: PaymentRail;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @Length(3, 8)
  currency!: string;
}
