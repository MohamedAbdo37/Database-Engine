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

export interface ExecutorIF {
    execute(ast: MainClassAST): Promise<void>;
}

@Injectable()
export class Executor {
    constructor(
        private readonly tableManager: TableManager,
        private readonly createExecutor: CreateExecutor,
        private readonly dropExecutor: DropExecutor,
        private readonly insertExecutor: InsertExecutor,
        private readonly updateExecutor: UpdateExecutor,
        private readonly deleteExecutor: DeleteExecutor,
    ) {}

    public async execute(ast: MainClassAST): Promise<void> {
        switch (ast.type) {
            case DDLType.CREATE_TABLE:
                await this.createExecutor.execute(ast as CreateTableAST);
                break;
            case DDLType.DROP_TABLE:
                await this.dropExecutor.execute(ast as DropTableAST);
                break;
            case DDLType.ALTER_TABLE:
                // Implement alter table logic here
                break;
            case DMLType.INSERT:
                await this.insertExecutor.execute(ast as InsertAST);
                break;
            case DMLType.SELECT:
                await this.executeSelect(ast as SelectAST);
                break;
            case DMLType.UPDATE:
                await this.updateExecutor.execute(ast as UpdateAST);
                break;
            case DMLType.DELETE:
                await this.deleteExecutor.execute(ast as DeleteAST);
                break;
            default:
                throw new Error(`Unsupported AST type: ${ast.type}`);
        }
    }

    private async executeSelect(ast: SelectAST): Promise<void> {
        const tables: { table: Table; alias: string }[] = [];

        for (const fromClause of ast.from) {
            let table = await this.tableManager.scanTable(fromClause.tableName);
            if (
                (ast.whereClause.rightColumnRef &&
                    (ast.whereClause.rightColumnRef === fromClause.alias ||
                        ast.whereClause.rightColumnRef ===
                            fromClause.tableName)) ||
                (ast.whereClause.leftColumnRef &&
                    (ast.whereClause.leftColumnRef === fromClause.alias ||
                        ast.whereClause.leftColumnRef === fromClause.tableName))
            ) {
                table = this.tableManager.whereEvaluate(
                    table,
                    ast.whereClause.operator,
                    ast.whereClause.rightOperand,
                    ast.whereClause.leftOperand,
                );
            }

            tables.push({
                table,
                alias: fromClause.alias || fromClause.tableName,
            });
        }

        // Implement the logic to fetch and display the selected data
        // This may involve joining tables, applying where conditions, ordering, and limiting results
        // For now, we will just log a message indicating that the SELECT operation was executed
        console.log(`SELECT operation executed successfully.`);
    }
}
