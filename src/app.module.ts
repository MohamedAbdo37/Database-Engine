import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SqlEngineModule } from './modules/sql-engine/sql-engine.module.js';

@Module({
    imports: [StorageModule, SqlEngineModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
