import { Equals, IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  // Legal-age attestation captured at signup. Real identity/age verification
  // still happens via the KYC module before any withdrawal is paid out.
  @Equals(true)
  ageConfirmed!: true;

  @IsOptional()
  @IsString()
  @Length(3, 32)
  referralCode?: string;
}
