import { Module } from "@nestjs/common";
import { CasesModule } from "../cases/cases.module";
import { WalletModule } from "../wallet/wallet.module";
import { GamesController } from "./games.controller";
import { GamesService } from "./games.service";

@Module({ imports: [CasesModule, WalletModule], controllers: [GamesController], providers: [GamesService] })
export class GamesModule {}
