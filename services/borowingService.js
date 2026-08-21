import path from "path";
import { readJSON, writeJSON } from "../utils/fileHelper.js";

import ValidationError from "../errors/ValidationError.js";
import NotFoundError from "../errors/NotFoundError.js";
import BusinessRuleError from "../errors/BusinessRuleError.js";
import { rejects } from "assert";

const BOOK_FILE_PATH = path.resolve("data", "books.json");
const BORROWING_FILE_PATH = path.resolve("data", "borrowings.json");



//-----------------Helper functions----------------------------------------------------------------

function validateId(id, fieldName){
    if(!Number.isInteger(id) || id <= 0)
        throw new ValidationError(`${fieldName} must be a positive integer.`);
}

function generateId(borrowings){
    if(borrowings.length === 0)  return 1;
    return Math.max(...borrowings.map(borrowing => borrowing.id)) + 1;
}

function findBook(books, id){
    return books.find(book => book.id === id);
}

function findActiveBorrowing(borrowings, bookId, userId){
    return borrowings.find(borrowing =>
        borrowing.bookId === bookId &&
        borrowing.userId === userId &&
        borrowing.returnedAt === null
    );
}



//-----------------Public APIs----------------------------------------------------------------------

async function borrowBook(bookId, userId){
    validateId(bookId, "Book Id");
    validateId(userId, "User Id");

    const borrowings = await readJSON(BORROWING_FILE_PATH);

    if(findActiveBorrowing(borrowings, bookId, userId))
        throw new BusinessRuleError("A user cannot have multiple active borrowings of the same book.");

    
    const books = await readJSON(BOOK_FILE_PATH);

    const book = findBook(books, bookId);

    if(!book)
        throw new NotFoundError("Book not found.");

    if(book.availableCopies === 0)
        throw new BusinessRuleError("No copies are available to borrow.");


    const borrowingRecord = {
        id: generateId(borrowings),
        userId: userId,
        bookId: bookId,
        borrowedAt: new Date().toISOString(),
        returnedAt: null
    };

    borrowings.push(borrowingRecord);

    book.availableCopies--;

    await writeJSON(BORROWING_FILE_PATH, borrowings);
    await writeJSON(BOOK_FILE_PATH, books);

    return borrowingRecord;
}


async function returnBook(bookId, userId){
    validateId(bookId);
    validateId(userId);

    const borrowings = await readJSON(BORROWING_FILE_PATH);
    const books = await readJSON(BOOK_FILE_PATH);

    const borrowRecord = findActiveBorrowing(borrowings, bookId, userId);

    if(!borrowRecord)
        throw new BusinessRuleError("Cannot return an unborrowed book.");
    
    const book = findBook(books, bookId);

    borrowRecord.returnedAt = new Date().toISOString();

    book.availableCopies++;

    await writeJSON(BORROWING_FILE_PATH, borrowings);
    await writeJSON(BOOK_FILE_PATH, books);

    return borrowRecord;
}




export {borrowBook, returnBook};