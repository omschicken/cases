import { Equals, IsOptional, IsString, Length } from "class-validator";

export class SteamCompleteDto {
  @IsString()
  pendingToken!: string;

  // Same legal-age attestation the email sign-up path requires — Steam
  // verifies identity, not age, so this step still has to ask.
  @Equals(true)
  ageConfirmed!: true;

  @IsOptional()
  @IsString()
  @Length(3, 32)
  referralCode?: string;
}
