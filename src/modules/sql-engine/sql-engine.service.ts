import { BadRequestException, Injectable } from '@nestjs/common';
import { Tokenizer } from './tokenizer/tokenizer.js';
import { ParserGenerator } from './parser/parser.js';
import { Executor } from './executor/executor.js';
import { DDLType, DMLType, MainClassAST } from './parser/ast/ast.class.js';

@Injectable()
export class SqlEngineService {
    constructor(
        private readonly tokenizer: Tokenizer,
        private readonly executor: Executor,
    ) {}

    async executeDDL(query: string): Promise<void> {
        const tokens = this.tokenizer.tokenize(query);

        const ast = new ParserGenerator(tokens).parse() as MainClassAST;

        if (!Object.values(DDLType).includes(ast.type as DDLType)) {
            throw new BadRequestException(
                `Expected DDL AST, but got ${ast.type}`,
            );
        }

        await this.executor.execute(ast as MainClassAST);

        console.log(`Executed DDL query: \n${query} \nsuccessfully.`);
    }

    async executeDML(query: string): Promise<void> {
        const tokens = this.tokenizer.tokenize(query);
        const ast = new ParserGenerator(tokens).parse() as MainClassAST;

        if (!Object.values(DMLType).includes(ast.type as DMLType)) {
            throw new BadRequestException(
                `Expected DML AST, but got ${ast.type}`,
            );
        }

        await this.executor.execute(ast as MainClassAST);

        console.log(`Executed DML query: \n${query} \nsuccessfully.`);
    }
}
