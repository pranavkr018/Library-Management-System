import { borrowBook } from "./services/borowingService.js";

async function test() {
    try{
        const borrowRecord = await borrowBook(7, 70);

        console.log(borrowRecord);

    }catch(err){
        console.log("Borrowing failed:");
        console.log(err);
    }
}

test();