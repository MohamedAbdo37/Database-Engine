import { Module } from '@nestjs/common';
import { SqlEngineService } from './sql-engine.service.js';

@Module({
  providers: [SqlEngineService]
})
export class SqlEngineModule {}
