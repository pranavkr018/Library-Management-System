import path from "path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { readJSON, writeJSON } from "../utils/fileHelper.js";

import ValidationError from "../errors/ValidationError.js";
import ConflictError from "../errors/ConflictError.js";
import AuthenticationError from "../errors/AuthenticationError.js";

const USER_FILE_PATH = path.resolve("data", "users.json");


//--------Helper Functions-----------------------------------------------------------------------------

function generateId(users){
    if(users.length === 0) return 1;
    return Math.max(...users.map(user => user.id)) + 1;
}

function normalize(text){
    return text.trim().toLowerCase();
}

function validateUserData(userData){
    if(typeof userData.username !== "string")
        throw new ValidationError("Username must be string.");

    if(typeof userData.password !== "string")
        throw new ValidationError("Password must be a string.");
}

function validateRegistrationData(userData){    
    const username = normalize(userData.username);
    
    if(username.length < 3 || username.length > 30)
        throw new ValidationError("Username must be between 3 to 30 characters.");
    
    const password = userData.password;
    
    if(password.length < 8)
        throw new ValidationError("Password must be at least 8 characters.");
    
}

function validateLoginData(userData){
    const username = normalize(userData.username);
    
    if(username.length < 3 || username.length > 30)
        throw new ValidationError("Username must be between 3 to 30 characters.");
}

function findExistingUsername(users, username, /*currId*/){
    return users.find(user => /*user.id != currId && */username === user.username);
}


//--------------Public APIs-----------------------------------------------------------

//register user
async function registerUser(userData){
    validateUserData(userData);
    validateRegistrationData(userData);

    const users = await readJSON(USER_FILE_PATH);
    
    const username = normalize(userData.username);

    const existingUser = findExistingUsername(users, username);

    if(existingUser)
        throw new ConflictError("Username already exists.")

    const id = generateId(users);

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const role = "user";

    const newUser = {
        id,
        username,
        passwordHash,
        role
    };

    users.push(newUser);

    await writeJSON(USER_FILE_PATH, users);

    return {
        id,
        username,
        role
    };
}


//login user
async function loginUser(userData){
    validateUserData(userData);
    validateLoginData(userData);

    const users = await readJSON(USER_FILE_PATH);

    const username = normalize(userData.username);

    const user = findExistingUsername(users, username);

    if(!user)
        throw new AuthenticationError("Invalid username or password.")  //avoiding username/account enumeration

    const isValidPassword = await bcrypt.compare(userData.password, user.passwordHash);

    if(!isValidPassword)
        throw new AuthenticationError("Invalid username or password.")

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
    )

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    }
}


export {registerUser, loginUser};