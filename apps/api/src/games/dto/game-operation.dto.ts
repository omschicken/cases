import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, IsIn } from "class-validator";

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

/** Mystery reward ranges are enforced again within GamesService. */
export class CreateMysteryUpgradeDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsIn([1.5, 2, 3, 5])
  multiplier!: number;
}

export class CreateBattleDto {
  @IsUUID()
  caseId!: string;
}
