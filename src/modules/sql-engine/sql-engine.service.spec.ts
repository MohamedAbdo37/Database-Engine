import { Test, TestingModule } from '@nestjs/testing';
import { SqlEngineService } from './sql-engine.service.js';

describe('SqlEngineService', () => {
    let service: SqlEngineService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SqlEngineService],
        }).compile();

        service = module.get<SqlEngineService>(SqlEngineService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
