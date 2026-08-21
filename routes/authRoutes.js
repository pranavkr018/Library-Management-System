import express from "express";
import * as authController from "../controllers/authController.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();


router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));




export default router;