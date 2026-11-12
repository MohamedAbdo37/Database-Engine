export class SyntaxErrorException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SyntaxErrorException';
    }
}
