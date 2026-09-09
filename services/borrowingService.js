import path from "path";
import { readJSON, writeJSON } from "../utils/fileHelper.js";

import pool from "../utils/db.js"

import ValidationError from "../errors/ValidationError.js";
import NotFoundError from "../errors/NotFoundError.js";
import BusinessRuleError from "../errors/BusinessRuleError.js";
import ConflictError from "../errors/ConflictError.js";
import AuthorizationError from "../errors/AuthorizationError.js";

const BOOK_FILE_PATH = path.resolve("data", "books.json");
const BORROWING_FILE_PATH = path.resolve("data", "borrowings.json");



//-----------------Helper functions----------------------------------------------------------------

function validateId(id, fieldName){
    if(!Number.isInteger(id) || id <= 0)
        throw new ValidationError(`${fieldName} must be a positive integer.`);
}

function validatePageAndLimit(page, limit){
    if(!Number.isInteger(page) || page < 1)
        throw new ValidationError("Page must be a positive integer.");

    if(!Number.isInteger(limit) || limit < 1)
        throw new ValidationError("Limit must be a positive integer.");

    if(limit > 100)
        throw new ValidationError("Limit cannot exceed 100.");
}



//-----------------Public APIs----------------------------------------------------------------------

// Borrow book
async function borrowBook(bookId, userId){
    validateId(bookId, "Book Id");
    validateId(userId, "User Id");

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const bookResult = await client.query(
            `SELECT * FROM books WHERE id = $1 FOR UPDATE`, 
            [bookId]
        );

        if(bookResult.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        const book = bookResult.rows[0];

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
            `INSERT INTO borrowings (user_id, book_id, borrowed_at) VALUES ($1, $2, NOW()) 
            RETURNING id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies"`, 
            [userId, bookId]
        );

        await client.query("COMMIT");

        return borrowingResult.rows[0];
    }
    catch(error){
        await client.query("ROLLBACK");

        if(error.code === "23505" && error.constraint === "unique_active_borrowing"){    // UNIQUE INDEX violation
            throw new ConflictError("An active borrowing for this book already exists.");
        }

        throw error;
    }
    finally{
        client.release();
    }
}


// Return book
async function returnBook(borrowingId, userId){
    validateId(borrowingId, "Borrowing Id");
    validateId(userId, "User Id");

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const borrowingResult = await client.query(
            `SELECT * FROM borrowings WHERE id = $1 FOR UPDATE`,
            [borrowingId]
        );

        if(borrowingResult.rows.length === 0){
            throw new NotFoundError("Borrowing record not found.");
        }

        const borrowing = borrowingResult.rows[0];
        
        if(borrowing.user_id !== userId){
            throw new AuthorizationError("You are unauthorized to close this borrowing.")
        }

        if(borrowing.returned_at !== null){
            throw new BusinessRuleError("Book already returned.")
        }

        const bookResult = await client.query(
            `SELECT * FROM books WHERE id = $1 FOR UPDATE`,
            [borrowing.book_id]
        );

        if(bookResult.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        const borrowingUpdate = await client.query(
            `UPDATE borrowings SET returned_at = NOW() WHERE id = $1 
            RETURNING id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies"`, 
            [borrowingId]
        );

        await client.query(
            `UPDATE books SET available_copies = available_copies + 1 WHERE id = $1`, 
            [borrowing.book_id]
        );

        await client.query("COMMIT");

        return borrowingUpdate.rows[0];
    }
    catch(error){
        await client.query("ROLLBACK");

        throw error;
    }
    finally{
        client.release();
    }
}



async function getBorrowings(role, filters){
    role = role.toLowerCase();

    //-------------------------------------------------------------------------------

    // PSQL Logic

    //-------------------------------------------------------------------------------
    
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