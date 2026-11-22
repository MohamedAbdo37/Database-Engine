import { DatatypeEnum } from '../../../storage/dto/datatype.dto.js';
import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import {
    ColumnConstraintEnum,
    ColumnDefinition,
} from '../ast/ddl/column-definition.ast.js';
import { Parser } from '../parser.class.js';

export class ColumnDefinitionParser extends Parser {
    columnDefinition: ColumnDefinition;
    constructor(tokens: Token[]) {
        super(tokens);
        this.columnDefinition = new ColumnDefinition();
    }

    private conflictConstraints(
        fConstraint: ColumnConstraintEnum,
        sConstraint: ColumnConstraintEnum,
        position: string,
    ): void {
        const fConstraintName =
            fConstraint === ColumnConstraintEnum.NOT_NULLABLE
                ? 'NOT NULL'
                : fConstraint === ColumnConstraintEnum.PRIMARY_KEY
                  ? 'PRIMARY KEY'
                  : fConstraint;

        const sConstraintName =
            sConstraint === ColumnConstraintEnum.NOT_NULLABLE
                ? 'NOT NULL'
                : sConstraint === ColumnConstraintEnum.PRIMARY_KEY
                  ? 'PRIMARY KEY'
                  : sConstraint;
        throw new SyntaxErrorException(
            `Conflicting constraints '${fConstraintName}' and '${sConstraintName}' found for column '${this.columnDefinition.name}' at ${position}.`,
        );
    }

    private duplicateConstraints(
        constraint: ColumnConstraintEnum,
        position: string,
    ): void {
        const constraintName =
            constraint === ColumnConstraintEnum.NOT_NULLABLE
                ? 'NOT NULL'
                : constraint === ColumnConstraintEnum.PRIMARY_KEY
                  ? 'PRIMARY KEY'
                  : constraint;
        throw new SyntaxErrorException(
            `Duplicate constraint '${constraintName}' found for column '${this.columnDefinition.name}' at ${position}.`,
        );
    }

    private setDatatype(): void {
        const datatypeToken = this.consume();
        if (datatypeToken === null || datatypeToken.type !== 'DATATYPE') {
            throw new SyntaxErrorException(
                `Expected datatype for column '${this.columnDefinition.name}', ` +
                    (datatypeToken !== null
                        ? `but found '${datatypeToken.value}' at ${datatypeToken.position}.`
                        : 'but found end of input.'),
            );
        }

        switch (datatypeToken.value.toUpperCase()) {
            case 'INT':
                this.columnDefinition.datatype = DatatypeEnum.INT;
                break;
            case 'INTEGER':
                this.columnDefinition.datatype = DatatypeEnum.INT;
                break;
            case 'DOUBLE':
                this.columnDefinition.datatype = DatatypeEnum.DOUBLE;
                break;
            case 'TIMESTAMP':
                this.columnDefinition.datatype = DatatypeEnum.TIMESTAMP;
                break;
            case 'DATETIME':
                this.columnDefinition.datatype = DatatypeEnum.DATETIME;
                break;
            case 'DATE':
                this.columnDefinition.datatype = DatatypeEnum.DATETIME;
                break;
            case 'SERIAL':
                this.columnDefinition.datatype = DatatypeEnum.SERIAL;
                break;
            case 'CHAR':
                this.setLength('CHAR');
                this.columnDefinition.datatype = DatatypeEnum.CHAR;
                break;
            case 'VARCHAR':
                this.setLength('VARCHAR');
                this.columnDefinition.datatype = DatatypeEnum.VARCHAR;
                break;
            case 'BOOLEAN':
                this.columnDefinition.datatype = DatatypeEnum.BOOLEAN;
                break;
            default:
                throw new SyntaxErrorException(
                    `Unsupported datatype '${datatypeToken.value}' for column '${this.columnDefinition.name}' at ${datatypeToken.position}.`,
                );
        }
    }

    private setLength(datatype: string): void {
        if (!this.expect(new PunctuationToken('('))) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Expected '(' after ${datatype} datatype for column '${this.columnDefinition.name}',` +
                    (token !== null
                        ? `but found '${token?.value}' at ${token?.position}.`
                        : 'but found end of input.'),
            );
        }
        this.consume();

        const lengthToken = this.consume();
        if (lengthToken === null || lengthToken.type !== 'NUMBER') {
            throw new SyntaxErrorException(
                `Expected length for ${datatype} datatype for column '${this.columnDefinition.name}', ` +
                    (lengthToken !== null
                        ? `but found '${lengthToken?.value}' at ${lengthToken?.position}.`
                        : 'but found end of input.'),
            );
        }

        if (!this.expect(new PunctuationToken(')'))) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Expected ')' after ${datatype} datatype for column '${this.columnDefinition.name}',` +
                    (token !== null
                        ? `but found '${token?.value}' at ${token?.position}.`
                        : 'but found end of input.'),
            );
        }
        this.consume();

        this.columnDefinition.length = parseInt(lengthToken.value, 10);
    }

    private isEndOfColumnDefinition(): boolean {
        let token = this.peek();
        if (
            token === null ||
            token.equals(new PunctuationToken(',')) ||
            token.equals(new PunctuationToken(')')) ||
            token.type != TokenType.KEYWORD
        ) {
            return true;
        }

        return false;
    }

    private setConstraints(): void {
        switch (true) {
            case this.expect(new KeywordToken('NOT')):
                let p1 = this.consume();
                let p2 = this.peek();
                if (p2 === null || !this.expect(new KeywordToken('NULL'))) {
                    throw new SyntaxErrorException(
                        `Expected 'NULL' after 'NOT' for column '${this.columnDefinition.name}', ` +
                            (p2 !== null
                                ? `but found '${p2?.value}' at ${p2?.position}.`
                                : 'but found end of input.'),
                    );
                }
                this.consume();

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.NOT_NULLABLE,
                    )
                ) {
                    this.duplicateConstraints(
                        ColumnConstraintEnum.NOT_NULLABLE,
                        p1!.position,
                    );
                }

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.NULLABLE,
                    )
                ) {
                    this.conflictConstraints(
                        ColumnConstraintEnum.NULLABLE,
                        ColumnConstraintEnum.NOT_NULLABLE,
                        p1!.position,
                    );
                }

                this.addConstraints(ColumnConstraintEnum.NOT_NULLABLE);
                break;

            case this.expect(new KeywordToken('NULL')):
                let token = this.consume();
                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.NULLABLE,
                    )
                )
                    this.duplicateConstraints(
                        ColumnConstraintEnum.NULLABLE,
                        token!.position,
                    );

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.UNIQUE,
                    )
                )
                    this.conflictConstraints(
                        ColumnConstraintEnum.UNIQUE,
                        ColumnConstraintEnum.NULLABLE,
                        token!.position,
                    );

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.NOT_NULLABLE,
                    )
                )
                    this.conflictConstraints(
                        ColumnConstraintEnum.NOT_NULLABLE,
                        ColumnConstraintEnum.NULLABLE,
                        token!.position,
                    );

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.PRIMARY_KEY,
                    )
                )
                    this.conflictConstraints(
                        ColumnConstraintEnum.PRIMARY_KEY,
                        ColumnConstraintEnum.NULLABLE,
                        token!.position,
                    );

                this.addConstraints(ColumnConstraintEnum.NULLABLE);
                break;

            case this.expect(new KeywordToken('UNIQUE')):
                let uniqueToken = this.consume();
                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.UNIQUE,
                    )
                )
                    this.duplicateConstraints(
                        ColumnConstraintEnum.UNIQUE,
                        uniqueToken!.position,
                    );
                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.NULLABLE,
                    )
                )
                    this.conflictConstraints(
                        ColumnConstraintEnum.NULLABLE,
                        ColumnConstraintEnum.UNIQUE,
                        uniqueToken!.position,
                    );
                this.addConstraints(ColumnConstraintEnum.UNIQUE);
                break;

            case this.expect(new KeywordToken('PRIMARY')):
                const primaryToken = this.consume();
                if (!this.expect(new KeywordToken('KEY'))) {
                    const token = this.peek();
                    throw new SyntaxErrorException(
                        `Expected 'KEY' after 'PRIMARY' for column '${this.columnDefinition.name}', ` +
                            (token !== null
                                ? `but found '${token?.value}' at ${token?.position}.`
                                : 'but found end of input.'),
                    );
                }
                this.consume();

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.PRIMARY_KEY,
                    )
                )
                    this.duplicateConstraints(
                        ColumnConstraintEnum.PRIMARY_KEY,
                        primaryToken!.position,
                    );

                if (
                    this.columnDefinition.constraints?.includes(
                        ColumnConstraintEnum.NULLABLE,
                    )
                )
                    this.conflictConstraints(
                        ColumnConstraintEnum.NULLABLE,
                        ColumnConstraintEnum.PRIMARY_KEY,
                        primaryToken!.position,
                    );
                this.addConstraints(ColumnConstraintEnum.PRIMARY_KEY);
                break;

            default:
                throw new SyntaxErrorException(
                    `Unexpected token '${this.peek()?.value}' at ${this.peek()?.position} while parsing constraints for column '${this.columnDefinition.name}'.`,
                );
        }
    }

    private addConstraints(constraints: ColumnConstraintEnum): void {
        this.columnDefinition.constraints?.push(constraints);
    }

    private setDefaultValue(): void {
        if (!this.expect(new KeywordToken('DEFAULT'))) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Expected 'DEFAULT' keyword for column '${this.columnDefinition.name}', but found '${token?.value}' at ${token?.position}.`,
            );
        }

        if (this.columnDefinition.datatype === DatatypeEnum.SERIAL) {
            throw new SyntaxErrorException(
                `Cannot set default value for column '${this.columnDefinition.name}' of type SERIAL.`,
            );
        }

        this.consume();

        const defaultValueToken = this.consume();
        if (
            defaultValueToken === null ||
            (this.columnDefinition.datatype !== DatatypeEnum.BOOLEAN &&
                defaultValueToken.type !== TokenType.LITERAL &&
                defaultValueToken.type !== TokenType.NUMBER)
        ) {
            throw new SyntaxErrorException(
                `Expected default value for column '${this.columnDefinition.name}', ` +
                    (defaultValueToken
                        ? `but found ${defaultValueToken.value} at ${defaultValueToken.position}.`
                        : 'but found end of input.'),
            );
        }

        if (
            this.columnDefinition.datatype === DatatypeEnum.INT ||
            this.columnDefinition.datatype === DatatypeEnum.DOUBLE
        ) {
            if (defaultValueToken.type !== TokenType.NUMBER) {
                throw new SyntaxErrorException(
                    `Expected numeric default value for column '${this.columnDefinition.name}', but found ${defaultValueToken.value} at ${defaultValueToken.position}.`,
                );
            }
        }

        if (this.columnDefinition.datatype === DatatypeEnum.BOOLEAN) {
            if (this.expect(new KeywordToken('TRUE'))) {
                defaultValueToken.value = 'TRUE';
            } else if (this.expect(new KeywordToken('FALSE'))) {
                defaultValueToken.value = 'FALSE';
            } else {
                throw new SyntaxErrorException(
                    `Expected boolean default value ('TRUE' or 'FALSE') for column '${this.columnDefinition.name}', but found ${defaultValueToken.value} at ${defaultValueToken.position}.`,
                );
            }
        }

        defaultValueToken.value = defaultValueToken.value.replace(
            /(?<!\\)'/g,
            '',
        );

        if (
            this.columnDefinition.datatype === DatatypeEnum.VARCHAR ||
            this.columnDefinition.datatype === DatatypeEnum.CHAR
        ) {
            if (defaultValueToken.type !== TokenType.LITERAL) {
                throw new SyntaxErrorException(
                    `Expected string default value for column '${this.columnDefinition.name}', but found '${defaultValueToken.value}' at ${defaultValueToken.position}.`,
                );
            }
            if (
                defaultValueToken.value.length > this.columnDefinition.length!
            ) {
                throw new SyntaxErrorException(
                    `Default value '${defaultValueToken.value}' exceeds the defined length of ${this.columnDefinition.length} for column '${this.columnDefinition.name}' at ${defaultValueToken.position}.`,
                );
            }
        }

        if (
            this.columnDefinition.datatype === DatatypeEnum.TIMESTAMP ||
            this.columnDefinition.datatype === DatatypeEnum.DATETIME
        ) {
            if (defaultValueToken.type !== TokenType.LITERAL) {
                throw new SyntaxErrorException(
                    `Expected date/time string default value for column '${this.columnDefinition.name}', but found '${defaultValueToken.value}' at ${defaultValueToken.position}.`,
                );
            }

            const dateValue = new Date(defaultValueToken.value);
            if (isNaN(dateValue.getTime())) {
                throw new SyntaxErrorException(
                    `Invalid date/time format for default value '${defaultValueToken.value}' for column '${this.columnDefinition.name}' at ${defaultValueToken.position}.`,
                );
            }
        }

        this.columnDefinition.defaultValue = defaultValueToken.value;
    }

    public parse(): ColumnDefinition {
        const columnNameToken = this.consume();
        if (columnNameToken === null || columnNameToken.type !== 'IDENTIFIER') {
            throw new SyntaxErrorException(
                `Expected column name, ` +
                    (columnNameToken !== null
                        ? `but found '${columnNameToken.value}' at ${columnNameToken.position}.`
                        : 'but found end of input.'),
            );
        }
        this.columnDefinition.name = columnNameToken.value;

        this.setDatatype();

        while (
            !this.isEndOfColumnDefinition() &&
            !this.expect(new KeywordToken('DEFAULT'))
        ) {
            this.setConstraints();
        }

        if (!this.isEndOfColumnDefinition()) {
            this.setDefaultValue();
        }

        return this.columnDefinition;
    }
}
