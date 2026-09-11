import * as borrowingService from "../services/borrowingService.js";



async function borrowBook(req, res){
    const bookId = Number(req.body.bookId);
    const userId = req.user.id;

    const borrowedRecord = await borrowingService.borrowBook(bookId, userId);

    res.status(201).json(borrowedRecord);
}

async function returnBook(req, res){
    const borrowingId = Number(req.params.id);
    const userId = req.user.id;

    const returnedRecord = await borrowingService.returnBook(borrowingId, userId);

    res.status(200).json(returnedRecord);
}

async function getBorrowings(req, res){
    const userId = req.user.id;
    const role = req.user.role;
    const filters = {
        ...req.query,
        borrowerId: role === "user" ? userId : req.query.borrowerId !== undefined ? Number(req.query.borrowerId) : undefined,
        sortBy: req.query.sortBy ?? "borrowedAt",
        order: req.query.order ?? "asc",
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 10)
    };
    const borrowingHistory = await borrowingService.getBorrowings(filters);

    res.status(200).json(borrowingHistory);
}




export {borrowBook, returnBook, getBorrowings};