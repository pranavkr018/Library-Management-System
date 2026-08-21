import express from "express";
import * as bookController from "../controllers/bookController.js";
import asyncHandler from "../middleware/asyncHandler.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();


router.get(
    "/",
    asyncHandler(bookController.getAllBooks)
);

router.get(
    "/:id",
    asyncHandler(bookController.getBookById)
);



router.post(
    "/",
    authMiddleware,
    authorize("admin"),
    asyncHandler(bookController.createBook)
);

router.post(
    "/:id/borrow",
    authMiddleware,
    asyncHandler(bookController.borrowBook)
);

router.post(
    "/:id/return",
    authMiddleware,
    asyncHandler(bookController.returnBook)
);



router.put(
    "/:id",
    authMiddleware,
    authorize("admin"),
    asyncHandler(bookController.updateBook)
);

router.delete(
    "/:id",
    authMiddleware,
    authorize("admin"),
    asyncHandler(bookController.deleteBook)
);



export default router;