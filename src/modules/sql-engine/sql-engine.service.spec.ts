import { Test, TestingModule } from '@nestjs/testing';
import { SqlEngineService } from './sql-engine.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { Tokenizer } from './tokenizer/tokenizer.js';
import { Executor } from './executor/executor.js';

describe('SqlEngineService', () => {
    let service: SqlEngineService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [StorageModule],
            providers: [SqlEngineService, Tokenizer, Executor],
        }).compile();

        service = module.get<SqlEngineService>(SqlEngineService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
