import BookCard from "./components/BookCard.jsx";

const book1 = {
  id: 4,
  title: "Clean Code",
  author: "Robert C. Martin", 
  category: "Programming", 
  totalCopies: 5,
  availableCopies: 3
}

const book2 = {
  id: 7,
  title: "The Pragmatic Programmer",
  author: "Andrew Hunt", 
  category: "Programming", 
  totalCopies: 5,
  availableCopies: 2
}

function App(){
  return(
    <div>
      <h1>Library Management System</h1>
      <p>Welcome to the library.</p>
      <BookCard book = {book1} />
      <BookCard book = {book2} />
    </div>
  )
}

export default App