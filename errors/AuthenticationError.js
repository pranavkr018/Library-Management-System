import AppError from "./AppError.js";

class AuthenticationError extends AppError{
    constructor(message){
        super(message, 401);
    }
}

export default AuthenticationError;