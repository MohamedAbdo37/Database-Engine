import { BadRequestException, Injectable } from '@nestjs/common';
import { Tokenizer } from './tokenizer/tokenizer.js';
import { ParserGenerator } from './parser/parsers/parser-generator.parser.js';
import { Executor } from './executor/executor.js';
import { DDLType, DMLType, MainClassAST } from './parser/ast/ast.class.js';
import { Validator } from './validator/validator.js';
import { Table } from '../storage/table-manager/table.dto.js';
import { Logger } from '../storage/logger/logger.js';

@Injectable()
export class SqlEngineService {
    constructor(
        private readonly tokenizer: Tokenizer,
        private readonly executor: Executor,
        private readonly validator: Validator,
        private readonly logger: Logger,
    ) {}

    private isDDLQuery(ast: MainClassAST): boolean {
        return Object.values(DDLType).includes(ast.type as DDLType);
    }

    private isDMLQuery(ast: MainClassAST): boolean {
        return Object.values(DMLType).includes(ast.type as DMLType);
    }

    async executeDDL(query: string): Promise<string> {
        let result: string = '';

        try {
            const tokens = this.tokenizer.tokenize(query);

            const ast = new ParserGenerator(tokens).parse() as MainClassAST;

            if (!this.isDDLQuery(ast)) {
                throw new BadRequestException(
                    `Expected DDL AST, but got ${ast.type}`,
                );
            }

            await this.validator.validate(ast as MainClassAST);

            result = (await this.executor.execute(
                ast as MainClassAST,
            )) as string;
        } catch (error) {
            await this.logger.logErrorDDL(query, error as Error);
            throw error;
        }

        await this.logger.logSuccessDDL(query);
        return result;
    }

    async executeDML(
        query: string,
    ): Promise<string | Record<string, unknown>[]> {
        let result: Table | string = '';
        try {
            const tokens = this.tokenizer.tokenize(query);
            const ast = new ParserGenerator(tokens).parse() as MainClassAST;

            if (!this.isDMLQuery(ast)) {
                throw new BadRequestException(
                    `Expected DML AST, but got ${ast.type}`,
                );
            }

            await this.validator.validate(ast as MainClassAST);
            result = await this.executor.execute(ast as MainClassAST);
        } catch (error) {
            await this.logger.logErrorDML(query, error as Error);
            throw error;
        }

        await this.logger.logSuccessDML(query);

        if (result instanceof Table) {
            return Table.mapTableToRows(result);
        }
        return result;
    }
}
