import { Module } from '@nestjs/common';
import { SqlEngineService } from './sql-engine.service.js';
import { Tokenizer } from './tokenizer/tokenizer.js';

@Module({
    providers: [SqlEngineService, Tokenizer],
    exports: [SqlEngineService, Tokenizer],
})
export class SqlEngineModule {}
