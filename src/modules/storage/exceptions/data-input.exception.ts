export class DatatypeException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatatypeException';
    }
}
