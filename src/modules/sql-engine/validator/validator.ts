import { Injectable } from '@nestjs/common';
import { DDLType, DMLType, MainClassAST } from '../parser/ast/ast.class.js';
import { CreateValidator } from './statements/create.validator.js';
import { CreateTableAST } from '../parser/ast/ddl/create-table.ast.js';
import { DropValidator } from './statements/drop.validator.js';
import { AlterValidator } from './statements/alter.validator.js';
import { InsertValidator } from './statements/insert.validator.js';
import { SelectValidator } from './statements/select.validator.js';
import { UpdateValidator } from './statements/update.validator.js';
import { DeleteValidator } from './statements/delete.validator.js';
import { DropTableAST } from '../parser/ast/ddl/drop-table.ast.js';
import { InsertAST } from '../parser/ast/dml/insert.ast.js';

export interface ValidatorIF {
    validate(ast: MainClassAST): Promise<void>;
}

@Injectable()
export class Validator implements ValidatorIF {
    constructor(
        private readonly createValidator: CreateValidator,
        private readonly dropValidator: DropValidator,
        private readonly alterValidator: AlterValidator,
        private readonly insertValidator: InsertValidator,
        private readonly selectValidator: SelectValidator,
        private readonly updateValidator: UpdateValidator,
        private readonly deleteValidator: DeleteValidator,
    ) {}

    public async validate(ast: MainClassAST): Promise<void> {
        switch (ast.type) {
            case DDLType.CREATE_TABLE:
                await this.createValidator.validate(ast as CreateTableAST);
                break;
            case DDLType.DROP_TABLE:
                await this.dropValidator.validate(ast as DropTableAST);
                break;
            case DDLType.ALTER_TABLE:
                await this.alterValidator.validate(ast);
                break;
            case DMLType.INSERT:
                await this.insertValidator.validate(ast as InsertAST);
                break;
            case DMLType.SELECT:
                await this.selectValidator.validate(ast);
                break;
            case DMLType.UPDATE:
                await this.updateValidator.validate(ast);
                break;
            case DMLType.DELETE:
                await this.deleteValidator.validate(ast);
                break;
            default:
                throw new SyntaxError(
                    `Validator for AST type ${ast.type} not implemented.`,
                );
        }
    }
}
