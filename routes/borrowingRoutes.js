import express from "express";
import * as borrowingController from "../controllers/borrowingController.js";
import asyncHandler from "../middleware/asyncHandler.js";
import authMiddleware from "../middleware/authMiddleware.js";


const router = express.Router();


router.get(
    "/",
    authMiddleware,
    asyncHandler(borrowingController.getBorrowings)
);


router.post(
    "/",
    authMiddleware,
    asyncHandler(borrowingController.borrowBook)
);

router.post(
    "/:id/return",
    authMiddleware,
    asyncHandler(borrowingController.returnBook)
);



export default router;