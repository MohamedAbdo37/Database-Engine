import { Injectable } from '@nestjs/common';
import {
    Catalog,
    CatalogColumn,
    CatalogIndex,
} from '../../../storage/dto/catalog.dto.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';
import { ColumnConstraintEnum } from '../../parser/ast/ddl/column-definition.ast.js';
import { CreateTableAST } from '../../parser/ast/ddl/create-table.ast.js';
import { ValidatorIF } from '../validator.js';

@Injectable()
export class CreateValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async validate(ast: CreateTableAST): Promise<void> {
        const isTableExists = await this.tableManager.isTableExists(
            ast.tableName,
        );

        if (isTableExists) {
            if (ast.ifNotExists) {
                console.log(
                    `Table '${ast.tableName}' already exists. Skipping creation as 'IF NOT EXISTS' clause is specified.`,
                );
                return;
            }

            throw new ExecutionErrorException(
                `Table '${ast.tableName}' already exists. Use 'IF NOT EXISTS' clause to avoid this error.`,
            );
        }
    }
}
