// Error.captureStackTrace(this, this.constructor);

class AppError extends Error{
    constructor(message, statusCode){
        super(message);

        this.statusCode = statusCode;
        this.name = this.constructor.name;
    }
}

export default AppError;