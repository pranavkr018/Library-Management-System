import * as authService from "../services/authService.js";


async function register(req, res){
    const user = await authService.registerUser(req.body);
    res.status(201).json(user);
}

async function login(reqq, res){
    const user = await authService.loginUser(reqq.body);
    res.status(200).json(user);
}


export {register, login};