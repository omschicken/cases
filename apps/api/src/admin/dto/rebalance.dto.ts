import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class RebalanceDto {
  /** Target RTP as a fraction, e.g. 0.9. */
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(0.99)
  rtp?: number;
}
