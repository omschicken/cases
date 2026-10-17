import { IsIn, IsNumber, Max, Min } from "class-validator";

export const CRYPTO_CURRENCIES = ["usdttrc20", "btc", "eth", "ltc"] as const;
export type CryptoCurrency = (typeof CRYPTO_CURRENCIES)[number];

export const MIN_CRYPTO_DEPOSIT_RUB = 100;
export const MAX_CRYPTO_DEPOSIT_RUB = 500_000;

export class CreateCryptoPaymentDto {
  @IsIn(CRYPTO_CURRENCIES)
  currency!: CryptoCurrency;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_CRYPTO_DEPOSIT_RUB)
  @Max(MAX_CRYPTO_DEPOSIT_RUB)
  amountRub!: number;
}
