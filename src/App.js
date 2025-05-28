import React, { useEffect, useState } from "react";
import "./App.css";
import { HashRouter as Router, Routes, Route, Link} from 'react-router-dom'; // Import necessary components
import axios from 'axios';

// Helper function to convert CSV to questions (shared by both quizzes)
function csvToQuestions(csvString) {
  const lines = csvString.trim().split("\n");
  const headers = lines[0].split(",");
  const questions = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const questionId = values[0];
    const questionText = values[1];
    const obj = { a: 2, b: 3, c: 4, d: 5 };
    const correctAnswerIndex = obj[values[6].replace("\r", "")]; // Assuming 'correct_ans' is at index 6
    const options = [];
    for (let j = 2; j <= 5; j++) {
      options.push({
        id: j - 2,
        text: values[j],
        isCorrect: j === correctAnswerIndex,
      });
    }
    
    questions.push({
      id: questionId,
      text: questionText,
      options: options,
      answer_explanation: values[7]
    });
  }
  // Shuffle the questions array once (using Fisher-Yates algorithm)
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];}
  const selected_questions = questions.slice(0,10);
  return selected_questions;
}

// QUIZ COMPONENT (reusable)
function Quiz({ googleSheetURL, quizTitle }) {
  // State Variables
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true); // ✅ New state to track loading
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false); // New state for button visibility
  const [responses, setResponses] = useState([]); // New state to store responses
  const [qids, setQids] = useState([]); // New state to store question IDs


  useEffect(() => {
    loadQuestions();
  }, [googleSheetURL]); // Add googleSheetURL as a dependency

  const loadQuestions = () => {
    setLoading(true); // ✅ Start loading

    fetch(googleSheetURL, {
      headers: { "content-type": "text/csv;charset=UTF-8" },
      method: "GET",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.text();
      })
      .then((csvData) => {
        const data = csvToQuestions(csvData);
        setQuestions(data);
        setLoading(false); // ✅ Stop loading when questions are set
        const question_ids = data.map(question => question.id);
        setQids(() => question_ids);  // Correct Way to Update State based on previous value.
      })
      .catch((error) => {
        console.error("Error fetching CSV file:", error);
        setLoading(false); // ✅ Stop loading even if there is an error

      })
  };

  useEffect(() => {
    console.log("qids in useEffect:", qids); // Correct: Shows the updated array
}, [qids]); // This useEffect runs whenever qids changes

  // Function to change score and show feedback after option click
  const optionClicked = (isCorrect, option) => {
    // Save first option clicked
    if (!selectedOption) {
    responses.push(option.id);
    }
    
    if (isCorrect) {
        if (!selectedOption) { // Only allow click if no option is selected yet
          setScore(score + 1);
          setFeedback("Correct :) !");
        }
      } else {setFeedback("Incorrect :( ");}  
    
    setSelectedOption(option); // This ensures that there is no change in responses, score and feedback when user clicks other options
    console.log(responses);
    setShowNextButton(true); // Show the "Next Question" button
  };

  const goToNextQuestion = () => {
    if (currentQuestion + 1 < questions.length) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setFeedback(null);
        setShowNextButton(false); // Hide the button
    } else {
        saveScore();
        setShowResults(true);
        setFeedback(null);
        setShowNextButton(false);
    }
};

const saveScore = async () => {
  console.log(qids);
  try {
      const scoreData = {
          quizName: quizTitle, // The quiz title
          score: score, // The user's score
          date: new Date().toISOString(), // Current date and time in ISO 8601 format (important!)
          question_ids: qids,
          responses: responses,
      };
      const response = await axios.post('https://airqualityquiz-backend.onrender.com/api/saveScore', scoreData); // Or your full URL if deployed
      console.log('Score saved successfully:', response.data); // Log the response from the server
  } catch (error) {
      console.error('Error saving score:', error); // Display an error message to the user
      if (error.response) {
          // The request was made and the server responded with a status code that falls out of the range of 2xx
          console.error("Response data:", error.response.data);
          console.error("Response status:", error.response.status);
          console.error("Response headers:", error.response.headers);
      } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.error("Request:", error.request);
      } else {
          // Something happened in setting up the request that triggered an Error
          console.error("Error message:", error.message);
      }
  }
};

const restartGame = () => {
    setScore(0);
    setCurrentQuestion(0);
    setShowResults(false);
    loadQuestions(); // Reload questions to shuffle
        
  };

  return (
    <div className="quiz-container"> {/* Add a class for styling */}
      <h1>{quizTitle}</h1> {/* Display the quiz title */}
      <p> Each quiz has 10 questions selected from a pool of questions. Participants are encouraged to take the test multiple times</p>
      {(loading) ? (<h2>Loading quiz...</h2>) : (
        <> {/* React fragment start */}
          <h2>Score: {score}</h2>
          {showResults ? ( 
            <div className="final-results">
              <h1>Final Results</h1>
              <h2>
                {score} out of {questions.length} correct - (
                {(score / questions.length) * 100}%)
              </h2>
              <button onClick={() => restartGame()}>Restart game</button> <br></br>
              <Link to="/"><button>Home</button></Link> <br /> {/* Link to Home */}
            </div>  
          ) : (
            <div className="question-card">
              <h2>
                Question: {currentQuestion + 1} out of {questions.length}
              </h2>
              <h3 className="question-text">{questions[currentQuestion]?.text}</h3>
              <ul>
                {questions[currentQuestion]?.options.map((option) => (
                  <li key={option.id} onClick={() => (optionClicked(option.isCorrect, option))}>
                    {option.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
           {/* Feedback */}
          {feedback && (
              <div className="feedback">
                  <p>{feedback}</p>
                  <p>Correct Answer: {questions[currentQuestion]?.options.find(opt => opt.isCorrect)?.text}</p>
                  <p>{questions[currentQuestion]?.answer_explanation}</p>
              </div>
          )}
          {/* Next Question Button */}
          {showNextButton && ( // Show the button only when showNextButton is true
                <button onClick={goToNextQuestion}>Next Question</button>
            )}
        </>
      )}
    </div>
  );
}

// APP COMPONENT
function App() {
  const GOOGLE_SHEET_CSV_URL_1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzzNg3HDQK3vUKpEnIwOREwa-SeRIcfYoECkL1qwivnChSUy5xrI7vE8Gpipuo_TxX6YDerL97rfGG/pub?gid=329704009&single=true&output=csv"; // URL for Quiz 1
  const GOOGLE_SHEET_CSV_URL_2 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzzNg3HDQK3vUKpEnIwOREwa-SeRIcfYoECkL1qwivnChSUy5xrI7vE8Gpipuo_TxX6YDerL97rfGG/pub?gid=0&single=true&output=csv"; // URL for Quiz 2

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <div>
              <h1>Air Quality Quizzes</h1>
              <Link to="/basic">Air Quality Basics Quiz</Link> <br /> {/* Link to Basic Quiz */}
              <Link to="/">Air Quality Advanced Quiz (Coming soon...) </Link> {/* Link to Advanced Quiz */}
            </div>
            }
          />
          
          <Route path="/basic" element={<Quiz googleSheetURL={GOOGLE_SHEET_CSV_URL_1} quizTitle="Air Quality Basics Quiz" />} />
          {/* <Route path="/advanced" element={<Quiz googleSheetURL={GOOGLE_SHEET_CSV_URL_2} quizTitle="Air Quality Advanced Quiz" />} /> */}
          {/* Add more routes as needed */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;