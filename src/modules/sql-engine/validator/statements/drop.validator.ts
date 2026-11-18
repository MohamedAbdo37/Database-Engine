import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { ValidatorIF } from '../validator.js';
import { DropTableAST } from '../../parser/ast/ddl/drop-table.ast.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';

@Injectable()
export class DropValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}
    public async validate(ast: DropTableAST): Promise<void> {
        const isTableExists = await this.tableManager.isTableExists(
            ast.tableName,
        );

        if (!isTableExists) {
            if (ast.ifExists) {
                console.log(
                    `Table '${ast.tableName}' does not exist. Skipping drop as 'IF EXISTS' clause is specified.`,
                );
                return;
            }

            throw new ExecutionErrorException(
                `Table '${ast.tableName}' does not exist. Use 'IF EXISTS' clause to avoid this error.`,
            );
        }
    }
}
