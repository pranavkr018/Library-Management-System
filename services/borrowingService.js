import path from "path";
import { readJSON, writeJSON } from "../utils/fileHelper.js";

import pool from "../utils/db.js"

import ValidationError from "../errors/ValidationError.js";
import NotFoundError from "../errors/NotFoundError.js";
import BusinessRuleError from "../errors/BusinessRuleError.js";
import AuthorizationError from "../errors/AuthorizationError.js";

const BOOK_FILE_PATH = path.resolve("data", "books.json");
const BORROWING_FILE_PATH = path.resolve("data", "borrowings.json");



//-----------------Helper functions----------------------------------------------------------------

function validateId(id, fieldName){
    if(!Number.isInteger(id) || id <= 0)
        throw new ValidationError(`${fieldName} must be a positive integer.`);
}

// function generateId(borrowings){
//     if(borrowings.length === 0)  return 1;
//     return Math.max(...borrowings.map(borrowing => borrowing.id)) + 1;
// }

// function findActiveBorrowingByBookId(borrowings, bookId, userId){
//     return borrowings.find(borrowing =>
//         borrowing.bookId === bookId &&
//         borrowing.userId === userId &&
//         borrowing.returnedAt === null
//     );
// }

function validatePageAndLimit(page, limit){
    if(!Number.isInteger(page) || page < 1)
        throw new ValidationError("Page must be a positive integer.");

    if(!Number.isInteger(limit) || limit < 1)
        throw new ValidationError("Limit must be a positive integer.");

    if(limit > 100)
        throw new ValidationError("Limit cannot exceed 100.");
}



//-----------------Public APIs----------------------------------------------------------------------

async function borrowBook(bookId, userId){
    validateId(bookId, "Book Id");
    validateId(userId, "User Id");

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const bookResults = await client.query(
            `SELECT * FROM books WHERE id = $1 FOR UPDATE`, 
            [bookId]
        );

        if(bookResults.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        const book = bookResults.rows[0];

        if(book.available_copies === 0){
            throw new BusinessRuleError("No copies are available to borrow.");
        }

        const borrowingCheck = await client.query(
            `SELECT EXISTS (SELECT 1 FROM borrowings WHERE user_id = $1 AND book_id = $2 AND returned_at IS NULL)`, 
            [userId, bookId]
        );

        if(borrowingCheck.rows[0].exists){
            throw new BusinessRuleError(
                "A user cannot have multiple active borrowings of the same book."
            );
        }

        await client.query(
            `UPDATE books SET available_copies = available_copies - 1 WHERE id = $1`, 
            [bookId]
        );

        const borrowingResult = await client.query(
            `INSERT INTO borrowings (user_id, book_id, borrowed_at) VALUES ($1, $2, NOW()) RETURNING *`, 
            [userId, bookId]
        );

        await client.query("COMMIT");

        return borrowingResult.rows[0];
    }
    catch(error){
        await client.query("ROLLBACK");

        throw error;
    }
    finally{
        client.release();
    }

    //JSON persistence
    // const borrowings = await readJSON(BORROWING_FILE_PATH);

    // if(findActiveBorrowingByBookId(borrowings, bookId, userId))
    //     throw new BusinessRuleError("A user cannot have multiple active borrowings of the same book.");

    
    // const books = await readJSON(BOOK_FILE_PATH);

    // const book = books.find(book => book.id === bookId);

    // if(!book)
    //     throw new NotFoundError("Book not found.");

    // if(book.availableCopies === 0)
    //     throw new BusinessRuleError("No copies are available to borrow.");


    // const borrowingRecord = {
    //     id: generateId(borrowings),
    //     userId: userId,
    //     bookId: bookId,
    //     borrowedAt: new Date().toISOString(),
    //     returnedAt: null
    // };

    // borrowings.push(borrowingRecord);

    // book.availableCopies--;

    // await writeJSON(BORROWING_FILE_PATH, borrowings);
    // await writeJSON(BOOK_FILE_PATH, books);

    // return borrowingRecord;
}



async function returnBook(borrowingId, userId){
    validateId(borrowingId, "Borrowing Id");
    validateId(userId, "User Id");

    const borrowings = await readJSON(BORROWING_FILE_PATH);
    
    const borrowRecord = borrowings.find(borrowing => borrowing.id === borrowingId);

    if(!borrowRecord)
        throw new NotFoundError("Borrowing record not found.");

    if(borrowRecord.userId !== userId)
        throw new AuthorizationError("You are unauthorized to close this borrowing.")

    if(borrowRecord.returnedAt !== null)
        throw new BusinessRuleError("Book already returned.")


    const books = await readJSON(BOOK_FILE_PATH);

    const book = books.find(book => book.id === borrowRecord.bookId);

    if(!book)
        throw new NotFoundError("Book associated with borrowing not found.");

    borrowRecord.returnedAt = new Date().toISOString();

    book.availableCopies++;

    await writeJSON(BORROWING_FILE_PATH, borrowings);
    await writeJSON(BOOK_FILE_PATH, books);

    return borrowRecord;
}



async function getBorrowings(role, filters){
    role = role.toLowerCase();
    
    if(role !== "user" && role !== "admin")
        throw new ValidationError("Allowed roles: User, Admin.")
    
    const active = filters.active?.toLowerCase();

    if(active !== undefined && active !== "true" && active !== "false")
        throw new ValidationError("Valid values for active: true, false, undefined");

    const sortBy = filters.sortBy.toLowerCase();

    const ValidSortFields = ["title", "author", "category", "totalcopies", "borrowedat", "returnedat"];

    if(!ValidSortFields.includes(sortBy)){
        throw new BusinessRuleError(
            `Cannot sort on "${filters.sortBy}". Available sortBy options: title, author, category, totalCopies, borrowedAt, returnedAt.`
        );

    }

    if(sortBy === "returnedat" && active !== "false"){
        throw new BusinessRuleError(
            "returnedAt can only be used for sorting when active=false."
        );
    }

    const order = filters.order.toLowerCase();

    if(!["asc", "desc"].includes(order)){
        throw new BusinessRuleError(`Cannot sort in "${filters.order}" order! Available order options: asc, desc.`);
    }

    const page = filters.page;
    const limit = filters.limit;

    validatePageAndLimit(page, limit);

    const borrowings = await readJSON(BORROWING_FILE_PATH);

    let borrowingHistory = borrowings;

    if(filters.borrowerId){
        validateId(filters.borrowerId, "Borrower Id");

        borrowingHistory = borrowingHistory.filter(borrowing => borrowing.userId === filters.borrowerId);
    }
    
    if(active === "true"){
        borrowingHistory = borrowingHistory.filter(borrowing => borrowing.returnedAt === null);
    }else if(active === "false"){
        borrowingHistory = borrowingHistory.filter(borrowing => borrowing.returnedAt !== null);
    }

    const books = await readJSON(BOOK_FILE_PATH);

    borrowingHistory.forEach(borrowing => {
        const book = books.find(book => book.id === borrowing.bookId);
        borrowing.book = book;
    });

    //sorting
    borrowingHistory.sort((bh1, bh2) => {
        if(sortBy === "borrowedat"){
            return order === "asc" ? bh1.borrowedAt.localeCompare(bh2.borrowedAt) : bh2.borrowedAt.localeCompare(bh1.borrowedAt);
        }

        if(sortBy === "returnedat"){
            return order === "asc" ? bh1.returnedAt.localeCompare(bh2.returnedAt) : bh2.returnedAt.localeCompare(bh1.returnedAt);
        }

        if(sortBy === "totalcopies"){
            return order === "asc" ? bh1.book.totalCopies - bh2.book.totalCopies : bh2.book.totalCopies - bh1.book.totalCopies;
        }

        return order === "asc" ? bh1.book[sortBy].localeCompare(bh2.book[sortBy]) : bh2.book[sortBy].localeCompare(bh1.book[sortBy]);
    });

    //pagination
    const total = borrowingHistory.length;

    const totalPages = Math.ceil(total / limit);

    const offset = (page - 1) * limit;

    const data = borrowingHistory.slice(offset, offset + limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
}




export {borrowBook, returnBook, getBorrowings};