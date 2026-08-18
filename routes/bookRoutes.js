import express from "express";
import * as bookController from "../controllers/bookController.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();


router.get("/", asyncHandler(bookController.getAllBooks));
router.get("/:id", asyncHandler(bookController.getBookById));

router.post("/", asyncHandler(bookController.createBook));
router.post("/:id/borrow", asyncHandler(bookController.borrowBook));
router.post("/:id/return", asyncHandler(bookController.returnBook));

router.put("/:id", asyncHandler(bookController.updateBook));

router.delete("/:id", asyncHandler(bookController.deleteBook));



export default router;