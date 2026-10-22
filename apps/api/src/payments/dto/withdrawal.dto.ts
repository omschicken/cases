import { IsEnum, IsInt, IsString, Length, Min } from "class-validator";
import { PaymentRail } from "@prisma/client";

export class WithdrawalDto {
  @IsEnum(PaymentRail)
  rail!: PaymentRail;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @Length(3, 8)
  currency!: string;

  @IsString()
  @Length(3, 256)
  destination!: string; // IBAN / crypto wallet address / Steam trade URL
}
