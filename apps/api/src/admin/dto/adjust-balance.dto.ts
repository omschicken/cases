import { IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class AdjustBalanceDto {
  /** Amount in whole currency units (e.g. 500 or 12.5). Negative debits. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-10_000_000)
  @Max(10_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  note?: string;
}
