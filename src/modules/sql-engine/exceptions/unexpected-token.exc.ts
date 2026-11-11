export class UnexpectedTokenException extends Error {
    constructor(token: string, line: number, curser: number) {
        super(`Unexpected token ${token} at position ${line}:${curser}`);
        this.name = 'UnexpectedTokenException';
    }
}
