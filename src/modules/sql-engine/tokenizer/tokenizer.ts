import { Injectable } from '@nestjs/common';
import {
    DatatypeToken,
    IdentifierToken,
    KeywordToken,
    LiteralToken,
    MultiCharacterOperatorToken,
    NumberToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
} from './token.class.js';
import { UnexpectedTokenException } from '../exceptions/unexpected-token.exc.js';

@Injectable()
export class Tokenizer {
    private readonly tokenTypes: Array<new () => Token> = [
        PunctuationToken,
        MultiCharacterOperatorToken,
        SingleCharacterOperatorToken,
        KeywordToken,
        DatatypeToken,
        IdentifierToken,
        NumberToken,
        LiteralToken,
    ];

    private readonly whitespaceRegex = new RegExp(`^([\\s]+)`);

    private isMatchingToken(tokenText: string): Token[] {
        return this.tokenTypes
            .map((TokenType) => new TokenType().isMatch(tokenText))
            .filter((token): token is Token => token !== null);
    }

    public tokenize(rawSQL: string): Token[] {
        const tokens: Token[] = [];
        const lines = rawSQL.trim().split('\n');

        for (let [idx, line] of lines.entries()) {
            let cursor = 0;
            line = line.trim();
            while (cursor < line.length) {
                const tokenText = line.slice(cursor);

                const matchingTokens = this.isMatchingToken(tokenText);
                if (matchingTokens.length > 0) {
                    const matchedToken = matchingTokens[0];
                    matchedToken.setPosition(idx + 1, cursor + 1);
                    tokens.push(matchedToken);
                    cursor += matchedToken.length;
                    continue;
                }
                if (!this.whitespaceRegex.test(tokenText)) {
                    throw new UnexpectedTokenException(
                        tokenText[0],
                        idx + 1,
                        cursor + 1,
                    );
                }
                cursor++;
            }
        }

        return tokens;
    }
}
