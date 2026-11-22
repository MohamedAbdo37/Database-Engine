import { Injectable } from '@nestjs/common';
import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    MultiCharacterOperatorToken,
    NumberToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import { AST } from '../ast/ast.class.js';
import { SelectAST } from '../ast/select.class.js';
import { Parser } from '../parser.class.js';
import { CreateParser } from './create.parser.js';
import { DropParser } from './drop.pareser.js';
import { InsertParser } from './insert.parser.js';
import { UpdateParser } from './update.parser.js';
import { DeleteParser } from './delete.parser.js';
import { SelectParser } from './select.parser.js';

@Injectable()
export class ParserGenerator extends Parser {
    constructor(tokens: Token[]) {
        super(tokens);
    }

    public parse(): AST | null {
        let token = this.peek();
        if (token === null) {
            throw new SyntaxErrorException(
                `Unexpected end of input while parsing SQL query.`,
            );
        }

        this.cleanTokens();
        let consumedTokens = 0;
        const remainingBefore = this.tokens.length;
        let ast: AST | null = null;
        switch (true) {
            case new KeywordToken('CREATE').equals(token):
                const createParser = new CreateParser(this.tokens);
                ast = createParser.parse();
                consumedTokens = remainingBefore - createParser.tokens.length;
                this.consume(0, consumedTokens);
                break;
            case new KeywordToken('DROP').equals(token):
                const dropParser = new DropParser(this.tokens);
                ast = dropParser.parse();
                consumedTokens = remainingBefore - dropParser.tokens.length;
                this.consume(0, consumedTokens);
                break;
            case new KeywordToken('INSERT').equals(token):
                const insertParser = new InsertParser(this.tokens);
                ast = insertParser.parse();
                consumedTokens = remainingBefore - insertParser.tokens.length;
                this.consume(0, consumedTokens);
                break;
            case new KeywordToken('UPDATE').equals(token):
                const updateParser = new UpdateParser(this.tokens);
                ast = updateParser.parse();
                consumedTokens = remainingBefore - updateParser.tokens.length;
                this.consume(0, consumedTokens);
                break;
            case new KeywordToken('DELETE').equals(token):
                const deleteParser = new DeleteParser(this.tokens);
                ast = deleteParser.parse();
                consumedTokens = remainingBefore - deleteParser.tokens.length;
                this.consume(0, consumedTokens);
                break;
            case new KeywordToken('SELECT').equals(token):
                const selectParser = new SelectParser(this.tokens);
                ast = selectParser.parse();
                consumedTokens = remainingBefore - selectParser.tokens.length;
                this.consume(0, consumedTokens);
                break;
            default:
                throw new SyntaxErrorException(
                    `Unexpected token '${token.value}' at ${token.position}.`,
                );
        }

        if (this.tokens.length > 0) {
            token = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${token?.value ?? 'end of input'}' at ${token?.position ?? 'unknown position'}.`,
            );
        }

        return ast;
    }

    private cleanTokens(start?: number): void {
        let id = start ?? 0;
        const containsUnresolvedOperands = this.tokens.some(
            (token) =>
                token.type === TokenType.IDENTIFIER ||
                token.type === TokenType.LITERAL,
        );

        while (id < this.tokens.length) {
            if (this.isExpressionToken(id)) {
                if (this.isExpression(id, containsUnresolvedOperands)) {
                    id++;
                    continue;
                }

                const expressionParser = new ParserGenerator(
                    this.tokens.slice(id),
                );
                const isBoolean = this.isBooleanExpression(id);
                const value = isBoolean
                    ? expressionParser.parseBooleanExpression(0)
                    : expressionParser.parseArithmeticExpression(0);
                const consumed =
                    this.tokens.slice(id).length -
                    expressionParser.tokens.length;

                if (consumed === 0) {
                    throw new SyntaxErrorException(
                        'Unable to consume expression while cleaning tokens.',
                    );
                }

                const cleanedToken =
                    isBoolean && containsUnresolvedOperands
                        ? new KeywordToken(value ? 'TRUE' : 'FALSE')
                        : new NumberToken(
                              (isBoolean ? (value ? 1 : 0) : value).toString(),
                          );
                this.tokens.splice(id, consumed, cleanedToken);
            }
            id++;
        }
    }

    private isExpressionToken(id: number): boolean {
        const token = this.tokens[id];
        const nextToken = this.peek(id + 1);
        if (token === undefined && nextToken === undefined) {
            return false;
        }

        return (
            token instanceof NumberToken ||
            token.value === '+' ||
            token.value === '-' ||
            (token.equals(new KeywordToken('NOT')) &&
                nextToken?.type !== TokenType.KEYWORD) ||
            (token.equals(new PunctuationToken('(')) &&
                this.isParenthesizedExpressionStart(id))
        );
    }

    private isParenthesizedExpressionStart(id: number): boolean {
        const previous = this.tokens[id - 1];
        if (previous === undefined) {
            return true;
        }

        return !(
            previous.equals(new KeywordToken('VALUES')) ||
            previous.type === TokenType.IDENTIFIER ||
            previous.type === TokenType.DATATYPE ||
            previous.equals(new PunctuationToken(','))
        );
    }

    private isExpression(
        id: number,
        containsUnresolvedOperands: boolean,
    ): boolean {
        return (
            containsUnresolvedOperands &&
            this.tokens
                .slice(id)
                .some(
                    (token) =>
                        token.type === TokenType.IDENTIFIER ||
                        token.type === TokenType.LITERAL,
                )
        );
    }

    private isBooleanExpression(id: number): boolean {
        let parenthesisDepth = 0;
        const tokensToCheck = this.tokens.slice(id);
        for (const token of tokensToCheck) {
            if (token.equals(new PunctuationToken('('))) {
                parenthesisDepth++;
                continue;
            }
            if (token.equals(new PunctuationToken(')'))) {
                if (parenthesisDepth === 0) {
                    break;
                }
                parenthesisDepth--;
                continue;
            }
            if (
                parenthesisDepth === 0 &&
                (token.equals(new PunctuationToken(',')) ||
                    token.equals(new PunctuationToken(';')))
            ) {
                break;
            }

            if (
                token.type === TokenType.MULTI_CHARACTER_OPERATOR ||
                ['<', '>', '=', 'AND', 'OR', 'NOT'].includes(
                    token.value.toUpperCase(),
                )
            ) {
                return true;
            }
        }

        return false;
    }

    private parseArithmeticExpression(start: number): number {
        return this.parseAddition(start);
    }

    private parseBooleanExpression(id: number): boolean {
        return this.parseORExpression(id);
    }

    private parseORExpression(id: number): boolean {
        let value = this.parseANDExpression(id);

        while (this.expect(new KeywordToken('OR'), id)) {
            this.consume(id);
            const right = this.parseANDExpression(id);
            value = value || right;
        }

        return value;
    }

    private parseANDExpression(id: number): boolean {
        let value = this.parseNOTExpression(id);

        while (this.expect(new KeywordToken('AND'), id)) {
            this.consume(id);
            const right = this.parseNOTExpression(id);
            value = value && right;
        }

        return value;
    }

    private parseNOTExpression(id: number): boolean {
        if (this.expect(new KeywordToken('NOT'), id)) {
            this.consume(id);
            return !this.parseNOTExpression(id);
        }

        if (
            this.expect(new PunctuationToken('('), id) &&
            this.isBooleanParenthesizedExpression(id)
        ) {
            this.consume(id);
            const value = this.parseORExpression(id);
            if (!this.expect(new PunctuationToken(')'), id)) {
                throw new SyntaxErrorException(
                    "Expected ')' to close boolean expression.",
                );
            }
            this.consume(id);
            return value;
        }

        return Boolean(this.parseEqualityExpression(id));
    }

    private isBooleanParenthesizedExpression(id: number): boolean {
        let depth = 0;
        for (const token of this.tokens.slice(id)) {
            if (token.equals(new PunctuationToken('('))) {
                depth++;
                continue;
            }
            if (token.equals(new PunctuationToken(')'))) {
                depth--;
                if (depth === 0) {
                    return false;
                }
                continue;
            }
            if (
                depth > 0 &&
                (token.type === TokenType.MULTI_CHARACTER_OPERATOR ||
                    ['<', '>', '=', 'AND', 'OR', 'NOT'].includes(
                        token.value.toUpperCase(),
                    ))
            ) {
                return true;
            }
        }
        return false;
    }

    private parseEqualityExpression(id: number): number | boolean {
        let value = this.parseRelationalExpression(id);

        while (
            this.expect(new SingleCharacterOperatorToken('='), id) ||
            this.expect(new MultiCharacterOperatorToken('=='), id) ||
            this.expect(new MultiCharacterOperatorToken('<>'), id)
        ) {
            const operator = this.consume(id)!.value;
            const right = this.parseRelationalExpression(id);
            value =
                operator === '=' || operator === '=='
                    ? value === right
                    : value !== right;
        }

        return value;
    }

    private parseRelationalExpression(id: number): number | boolean {
        let value: number | boolean = this.parseAddition(id);

        while (
            this.expect(new SingleCharacterOperatorToken('<'), id) ||
            this.expect(new SingleCharacterOperatorToken('>'), id) ||
            this.expect(new MultiCharacterOperatorToken('<='), id) ||
            this.expect(new MultiCharacterOperatorToken('>='), id)
        ) {
            const operator = this.consume(id)!.value;
            const right = this.parseAddition(id);
            switch (operator) {
                case '<':
                    value = Number(value) < right;
                    break;
                case '>':
                    value = Number(value) > right;
                    break;
                case '<=':
                    value = Number(value) <= right;
                    break;
                case '>=':
                    value = Number(value) >= right;
                    break;
            }
        }

        return value;
    }

    private parseAddition(id: number): number {
        let value = this.parseMultiplication(id);

        while (
            this.expect(new SingleCharacterOperatorToken('+'), id) ||
            this.expect(new SingleCharacterOperatorToken('-'), id)
        ) {
            const operator = this.consume(id)!.value;
            const right = this.parseMultiplication(id);
            value = operator === '+' ? value + right : value - right;
        }

        return value;
    }

    private parseMultiplication(id: number): number {
        let value = this.parseUnary(id);

        while (
            this.expect(new SingleCharacterOperatorToken('*'), id) ||
            this.expect(new SingleCharacterOperatorToken('/'), id) ||
            this.expect(new SingleCharacterOperatorToken('%'), id)
        ) {
            const operator = this.consume(id)!.value;
            const right = this.parseUnary(id);

            if ((operator === '/' || operator === '%') && right === 0) {
                throw new SyntaxErrorException(
                    `Division by zero in numeric expression. at ${
                        this.peek(id)?.position ?? 'unknown position'
                    }.`,
                );
            }

            value =
                operator === '*'
                    ? value * right
                    : operator === '/'
                      ? value / right
                      : value % right;
        }

        return value;
    }

    private parseUnary(id: number): number {
        if (
            this.expect(new SingleCharacterOperatorToken('+'), id) ||
            this.expect(new SingleCharacterOperatorToken('-'), id)
        ) {
            const operator = this.consume(id)!.value;
            const value = this.parseUnary(id);
            return operator === '-' ? -value : value;
        }

        return this.parsePower(id);
    }

    private parsePower(id: number): number {
        const value = this.parsePrimary(id);

        if (this.expect(new SingleCharacterOperatorToken('^'), id)) {
            this.consume(id);
            return Math.pow(value, this.parseUnary(id));
        }

        return value;
    }

    private parsePrimary(id: number): number {
        const token = this.peek(id);

        if (token?.type === TokenType.NUMBER) {
            this.consume(id);
            return Number(token.value);
        }

        if (token?.equals(new PunctuationToken('('))) {
            this.consume(id);
            const value = this.parseArithmeticExpression(id);

            if (!this.expect(new PunctuationToken(')'), id)) {
                throw new SyntaxErrorException(
                    `Expected ')' to close numeric expression${token.position ? ` at ${token.position}` : ''}.`,
                );
            }
            this.consume(id);
            return value;
        }

        throw new SyntaxErrorException(
            token
                ? `Expected a number in numeric expression, but found '${token.value}' at ${token.position}.`
                : 'Expected a number in numeric expression, but found end of input.',
        );
    }
}
