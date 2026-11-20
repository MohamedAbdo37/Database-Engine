import { Injectable } from '@nestjs/common';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { DDLType, DMLType, MainClassAST } from '../parser/ast/ast.class.js';
import { CreateTableAST } from '../parser/ast/ddl/create-table.ast.js';
import { ExecutionErrorException } from '../exceptions/execution-error.exc.js';
import { DropTableAST } from '../parser/ast/ddl/drop-table.ast.js';
import { InsertAST } from '../parser/ast/dml/insert.ast.js';
import { UpdateAST } from '../parser/ast/dml/update.ast.js';
import { Table } from '../../storage/table-manager/table.dto.js';
import { DeleteAST } from '../parser/ast/dml/delete.ast.js';
import { SelectAST, SelectClause } from '../parser/ast/select.class.js';
import { CreateExecutor } from './executors/create.executor.js';
import { DropExecutor } from './executors/drop.executor.js';
import { InsertExecutor } from './executors/insert.executor.js';
import { UpdateExecutor } from './executors/update.executor.js';
import { DeleteExecutor } from './executors/delete.executor.js';
import { SelectExecutor } from './executors/select.executor.js';

export interface ExecutorIF {
    execute(ast: MainClassAST): Promise<string | Table>;
}

@Injectable()
export class Executor {
    constructor(
        private readonly createExecutor: CreateExecutor,
        private readonly dropExecutor: DropExecutor,
        private readonly insertExecutor: InsertExecutor,
        private readonly updateExecutor: UpdateExecutor,
        private readonly deleteExecutor: DeleteExecutor,
        private readonly selectExecutor: SelectExecutor,
    ) {}

    public async execute(ast: MainClassAST): Promise<void | Table | string> {
        switch (ast.type) {
            case DDLType.CREATE_TABLE:
                return await this.createExecutor.execute(ast as CreateTableAST);
            case DDLType.DROP_TABLE:
                return await this.dropExecutor.execute(ast as DropTableAST);
            case DDLType.ALTER_TABLE:
                return 'ALTER TABLE execution is not implemented yet.';
            case DMLType.INSERT:
                return await this.insertExecutor.execute(ast as InsertAST);
            case DMLType.SELECT:
                return await this.selectExecutor.execute(ast as SelectAST);
            case DMLType.UPDATE:
                return await this.updateExecutor.execute(ast as UpdateAST);
            case DMLType.DELETE:
                return await this.deleteExecutor.execute(ast as DeleteAST);
            default:
                throw new Error(`Unsupported AST type: ${ast.type}`);
        }
    }
}
