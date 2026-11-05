import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ParserModule } from './modules/parser/parser.module.js';
import { StorageModule } from './modules/storage/storage.module.js';

@Module({
  imports: [ParserModule, StorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
