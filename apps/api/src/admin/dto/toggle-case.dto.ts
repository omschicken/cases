import { IsBoolean } from "class-validator";

export class ToggleCaseDto {
  @IsBoolean()
  isActive!: boolean;
}
