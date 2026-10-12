import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class CreateContractDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  inventoryItemIds!: string[];
}

export class CreateUpgradeDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsUUID()
  targetCaseItemId!: string;
}

export class CreateBattleDto {
  @IsUUID()
  caseId!: string;
}
