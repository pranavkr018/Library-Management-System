import { useState } from "react";

function BookCard({book}){
    const [availableCopies, setAvailableCopies] = useState(book.availableCopies);
    
    function borrowBook(){
        if(availableCopies > 0)
            setAvailableCopies(current => current - 1);
        else
            alert("No available copies to borrow.")
    }
    
    return(
        <div>
            <div>Title: {book.title}</div>
            <div>Author: {book.author}</div>
            <div>Category: {book.category}</div>
            <div>Available copies: {availableCopies} 
                <div>
                    <button onClick={borrowBook}>Borrow</button>
                </div>        
            </div>
        </div>
    )
}

export default BookCard;