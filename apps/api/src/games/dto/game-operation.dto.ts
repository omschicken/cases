import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsUUID } from "class-validator";

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

export class CreateBattleRoomDto {
  @IsUUID("4")
  requestKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUUID("4", { each: true })
  caseIds!: string[];

  @IsIn([2, 3, 4])
  maxPlayers!: number;
}
