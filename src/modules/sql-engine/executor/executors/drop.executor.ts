import { Injectable } from '@nestjs/common';
import { ExecutorIF } from '../executor.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { DropTableAST } from '../../parser/ast/ddl/drop-table.ast.js';

@Injectable()
export class DropExecutor implements ExecutorIF {
    constructor(private readonly tableManager: TableManager) {}
    public async execute(ast: DropTableAST): Promise<void> {
        await this.tableManager.dropTable(ast.tableName);
    }
}
