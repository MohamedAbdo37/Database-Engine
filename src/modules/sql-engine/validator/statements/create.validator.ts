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

        if (ast.columns.length === 0) {
            throw new ExecutionErrorException(
                `Table '${ast.tableName}' must have at least one column defined.`,
            );
        }

        const primaryKeyColumns = ast.columns.filter((column) =>
            column.constraints.some(
                (constraint) => constraint === ColumnConstraintEnum.PRIMARY_KEY,
            ),
        );

        if (primaryKeyColumns.length > 1) {
            throw new ExecutionErrorException(
                `Table '${ast.tableName}' cannot have multiple primary keys defined.`,
            );
        }

        for (const column of ast.columns) {
            if (
                column.constraints.includes(ColumnConstraintEnum.PRIMARY_KEY) &&
                column.constraints.includes(ColumnConstraintEnum.NULLABLE)
            ) {
                throw new ExecutionErrorException(
                    `Column '${column.name}' cannot be both primary and nullable.`,
                );
            }
        }
    }
}
