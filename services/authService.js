import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../utils/db.js";

import ValidationError from "../errors/ValidationError.js";
import ConflictError from "../errors/ConflictError.js";
import AuthenticationError from "../errors/AuthenticationError.js";


//--------Helper Functions-----------------------------------------------------------------------------

function normalize(text){
    return text.trim().toLowerCase();
}

function validateUserData(userData){
    if(typeof userData.username !== "string")
        throw new ValidationError("Username must be a string.");

    if(typeof userData.password !== "string")
        throw new ValidationError("Password must be a string.");
}

function validateRegistrationData(userData){    
    const username = normalize(userData.username);
    
    if(username.length < 3 || username.length > 30)
        throw new ValidationError("Username must be between 3 and 30 characters.");
    
    const password = userData.password;
    
    if(password.length < 8)
        throw new ValidationError("Password must be at least 8 characters.");
    
}

function validateLoginData(userData){
    const username = normalize(userData.username);
    
    if(username.length < 3 || username.length > 30)
        throw new ValidationError("Username must be between 3 and 30 characters.");
}


//--------------Public APIs-----------------------------------------------------------

//register user
async function registerUser(userData){
    validateUserData(userData);
    validateRegistrationData(userData);

    const username = normalize(userData.username);

    const passwordHash = await bcrypt.hash(userData.password, 10);

    const role = "user";

    try{
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, role) 
            VALUES ($1, $2, $3) RETURNING id, username, role`, 
            [username, passwordHash, role]
        );
        
        return {
            user: result.rows[0]
        };
    }
    catch(error){
        if(error.code === "23505" && error.constraint === "users_username_key")
            throw new ConflictError("Username already exists.");

        throw error;
    }
}


//login user
async function loginUser(userData){
    validateUserData(userData);
    validateLoginData(userData);

    const username = normalize(userData.username);

    const userResult = await pool.query(
        `SELECT id, username, password_hash as "passwordHash", role FROM users WHERE username = $1;`, 
        [username]
    );

    if(userResult.rows.length === 0)
        throw new AuthenticationError("Invalid username or password.");     //avoiding username/account enumeration

    const user = userResult.rows[0];

    const isValidPassword = await bcrypt.compare(userData.password, user.passwordHash);

    if(!isValidPassword)
        throw new AuthenticationError("Invalid username or password.");

    //login success
    const payload = {
        id: user.id, 
        username: user.username, 
        role: user.role
    };

    const token = jwt.sign(
        payload, 
        process.env.JWT_SECRET_KEY, 
        {
            expiresIn: "1h"
        }
    );

    return {
        token, 
        user: {
            id: user.id, 
            username: user.username, 
            role: user.role
        }
    };
}


export {registerUser, loginUser};