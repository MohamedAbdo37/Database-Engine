import { Module } from '@nestjs/common';
import { SqlEngineService } from './sql-engine.service.js';
import { Tokenizer } from './tokenizer/tokenizer.js';
import { Executor } from './executor/executor.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
    imports: [StorageModule],
    providers: [SqlEngineService, Tokenizer, Executor],
    exports: [SqlEngineService, Tokenizer],
})
export class SqlEngineModule {}
