import path from "path";
import { readJSON, writeJSON } from "../utils/fileHelper.js";

import pool from "../utils/db.js"

import ValidationError from "../errors/ValidationError.js";
import NotFoundError from "../errors/NotFoundError.js";
import BusinessRuleError from "../errors/BusinessRuleError.js";
import ConflictError from "../errors/ConflictError.js";
import AuthorizationError from "../errors/AuthorizationError.js";



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
            `SELECT 
            id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies" 
            FROM books WHERE id = $1 FOR UPDATE`, 
            [bookId]
        );

        if(bookResult.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        const book = bookResult.rows[0];

        if(book.availableCopies === 0){
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
            RETURNING id, book_id AS "bookId", user_id AS "userId", borrowed_at AS "borrowedAt", returned_at AS "returnedAt"`, 
            [userId, bookId]
        );

        await client.query("COMMIT");

        return {
            data: borrowingResult.rows[0]
        };
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
            `SELECT 
            id, book_id AS "bookId", user_id AS "userId", borrowed_at AS "borrowedAt", returned_at AS "returnedAt" 
            FROM borrowings WHERE id = $1 FOR UPDATE`,
            [borrowingId]
        );

        if(borrowingResult.rows.length === 0){
            throw new NotFoundError("Borrowing record not found.");
        }

        const borrowing = borrowingResult.rows[0];
        
        if(borrowing.userId !== userId){
            throw new AuthorizationError("You are unauthorized to close this borrowing.")
        }

        if(borrowing.returnedAt !== null){
            throw new BusinessRuleError("Book already returned.")
        }

        const bookResult = await client.query(
            `SELECT 
            id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies" 
            FROM books WHERE id = $1 FOR UPDATE`,
            [borrowing.bookId]
        );

        if(bookResult.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        const borrowingUpdate = await client.query(
            `UPDATE borrowings SET returned_at = NOW() WHERE id = $1 
            RETURNING id, book_id AS "bookId", user_id AS "userId", borrowed_at AS "borrowedAt", returned_at AS "returnedAt"`, 
            [borrowingId]
        );

        await client.query(
            `UPDATE books SET available_copies = available_copies + 1 WHERE id = $1`, 
            [borrowing.bookId]
        );

        await client.query("COMMIT");

        return {
            data: borrowingUpdate.rows[0]
        };
    }
    catch(error){
        await client.query("ROLLBACK");

        throw error;
    }
    finally{
        client.release();
    }
}



async function getBorrowings(filters){
    const page = filters.page;
    const limit = filters.limit;

    validatePageAndLimit(page, limit);

    const conditions = [];
    const values = [];

    if(filters.borrowerId !== undefined){
        validateId(filters.borrowerId, "Borrower Id");

        conditions.push(`b.user_id = $${values.length + 1}`);
        values.push(filters.borrowerId);
    }

    if(filters.active === "true"){
        conditions.push(`b.returned_at IS NULL`);
    }
    else if(filters.active === "false"){
        conditions.push(`b.returned_at IS NOT NULL`);
    }

    if(filters.title){
        conditions.push(`bk.title ILIKE $${values.length + 1}`);
        values.push(`%${filters.title}%`);
    }

    if(filters.author){
        conditions.push(`bk.author ILIKE $${values.length + 1}`);
        values.push(`%${filters.author}%`);
    }

    if(filters.category){
        conditions.push(`bk.category ILIKE $${values.length + 1}`);
        values.push(`%${filters.category}%`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    const sortColumns = {
        borrowedAt: "b.borrowed_at",
        returnedAt: "b.returned_at",
        title: "bk.title",
        author: "bk.author",
        category: "bk.category",
        totalCopies: "bk.total_copies",
        availableCopies: "bk.available_copies"
    };

    const sortBy = filters.sortBy ?? "borrowedAt";

    if(sortBy === "returnedAt" && filters.active !== "false"){
        throw new BusinessRuleError(
            "returnedAt can only be used for sorting when active=false."
        );
    }
    
    const sortColumn = sortColumns[sortBy];
    
    if(!sortColumn)
        throw new ValidationError("Invalid sortBy field.")

    const order = filters.order ?? "asc";

    if(order !== "asc" && order !== "desc")
        throw new ValidationError("Order must be either asc or desc.")
    
    const sortOrder = order === "desc" ? "DESC" : "ASC";

    const countResult = await pool.query(
        `SELECT COUNT(*) 
        FROM borrowings b 
        INNER JOIN books bk 
        ON b.book_id = bk.id 
        ${whereClause}`, 
        values
    );

    const total = Number(countResult.rows[0].count);

    const totalPages = Math.ceil(total / limit);

    const offset = (page - 1) * limit;

    const dataResult = await pool.query(
        `SELECT 
            b.id, b.book_id AS "bookId", b.user_id AS "userId", b.borrowed_at AS "borrowedAt", b.returned_at AS "returnedAt", 
            bk.title, bk.author, bk.category, bk.total_copies AS "totalCopies", bk.available_copies AS "availableCopies" 
        FROM borrowings b 
        INNER JOIN books bk 
        ON b.book_id = bk.id 
        ${whereClause} 
        ORDER BY ${sortColumn} ${sortOrder}, b.id ASC 
        LIMIT $${values.length + 1} 
        OFFSET $${values.length + 2}`, 

        [...values, limit, offset]
    );

    const data = dataResult.rows.map(row => (
        {
            id: row.id, 
            userId: row.userId, 
            bookId: row.bookId, 
            borrowedAt: row.borrowedAt, 
            returnedAt: row.returnedAt, 
            book: {
                id: row.bookId, 
                title: row.title, 
                author: row.author, 
                category: row.category,
                totalCopies: row.totalCopies, 
                availableCopies: row.availableCopies
            }
        }
    ));

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