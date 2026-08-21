import AppError from "./AppError.js";

class AuthorizationError extends AppError{
    constructor(message){
        super(message, 403);
    }
}


export default AuthorizationError;