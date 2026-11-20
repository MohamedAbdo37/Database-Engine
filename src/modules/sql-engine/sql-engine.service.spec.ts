import { Test, TestingModule } from '@nestjs/testing';
import { SqlEngineService } from './sql-engine.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { Tokenizer } from './tokenizer/tokenizer.js';
import { Executor } from './executor/executor.js';
import { Validator } from './validator/validator.js';
import { CreateValidator } from './validator/statements/create.validator.js';
import { DropValidator } from './validator/statements/drop.validator.js';
import { AlterValidator } from './validator/statements/alter.validator.js';
import { InsertValidator } from './validator/statements/insert.validator.js';
import { SelectValidator } from './validator/statements/select.validator.js';
import { UpdateValidator } from './validator/statements/update.validator.js';
import { DeleteValidator } from './validator/statements/delete.validator.js';
import { CreateExecutor } from './executor/executors/create.executor.js';
import { DropExecutor } from './executor/executors/drop.executor.js';
import { InsertExecutor } from './executor/executors/insert.executor.js';
import { UpdateExecutor } from './executor/executors/update.executor.js';
import { DeleteExecutor } from './executor/executors/delete.executor.js';
import { SelectExecutor } from './executor/executors/select.executor.js';

describe('SqlEngineService', () => {
    let service: SqlEngineService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [StorageModule],
            providers: [
                SqlEngineService,
                Tokenizer,
                Executor,
                Validator,
                CreateValidator,
                DropValidator,
                AlterValidator,
                InsertValidator,
                SelectValidator,
                UpdateValidator,
                DeleteValidator,
                CreateExecutor,
                DropExecutor,
                InsertExecutor,
                UpdateExecutor,
                DeleteExecutor,
                SelectExecutor,
            ],
        }).compile();

        service = module.get<SqlEngineService>(SqlEngineService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
