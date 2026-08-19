import React, { useEffect, useState } from "react";
import "./App.css";
import { HashRouter as Router, Routes, Route, Link} from 'react-router-dom';
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
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const [responses, setResponses] = useState([]);
  const [qids, setQids] = useState([]);
  const [userName, setUserName] = useState("");
  const [hasStarted, setHasStarted] = useState(false); 

  useEffect(() => {
    loadQuestions();
  }, [googleSheetURL]);

  const loadQuestions = () => {
    setLoading(true);

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
        setLoading(false);
        const question_ids = data.map(question => question.id);
        setQids(() => question_ids); 
      })
      .catch((error) => {
        console.error("Error fetching CSV file:", error);
        setLoading(false); 
      })
  };

  useEffect(() => {
    console.log("qids in useEffect:", qids); 
  }, [qids]); 

  // Function to change score and show feedback after option click
  const optionClicked = (isCorrect, option) => {
    if (!selectedOption) {
      responses.push(option.id);
    }
    
    if (isCorrect) {
        if (!selectedOption) { 
          setScore(score + 1);
          setFeedback("Correct :) !");
        }
      } else {setFeedback("Incorrect :( ");}  
    
    setSelectedOption(option); 
    console.log(responses);
    setShowNextButton(true); 
  };

  const goToNextQuestion = () => {
    if (currentQuestion + 1 < questions.length) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setFeedback(null);
        setShowNextButton(false); 
    } else {
        saveScore(userName); 
        setShowResults(true);
        setFeedback(null);
        setShowNextButton(false);
    }
  };

  const saveScore = async (name) => {
    console.log(qids);
    try {
        const scoreData = {
            quizName: quizTitle,
            score: score,
            name: name?.trim() || null,
            date: new Date().toISOString(),
            question_ids: qids,
            responses: responses,
        };
        const response = await axios.post('https://airqualityquiz-backend.onrender.com/api/saveScore', scoreData); 
        console.log('Score saved successfully:', response.data); 
    } catch (error) {
        console.error('Error saving score:', error);
        if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Response status:", error.response.status);
            console.error("Response headers:", error.response.headers);
        } else if (error.request) {
            console.error("Request:", error.request);
        } else {
            console.error("Error message:", error.message);
        }
    }
  };

  const restartGame = () => {
    setScore(0);
    setCurrentQuestion(0);
    setShowResults(false);
    setHasStarted(false); 
    setUserName(""); 
    setResponses([]); 
    loadQuestions(); 
  };

  return (
    <div className="quiz-container">
      <h1>{quizTitle}</h1> 
      <p> Each quiz has 10 questions selected from a pool of questions. Participants are encouraged to take the test multiple times</p>
      
      {loading ? (<h2>Loading quiz...</h2>) : (
        !hasStarted ? (
          <div className="start-screen">
            <h2>Welcome!</h2>
            <label htmlFor="user-name" style={{ display: "block", marginBottom: "10px" }}>
              Enter your name (optional):
            </label>
            <input
              id="user-name"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setHasStarted(true); // ✅ Starts the quiz on Enter
                }
              }}
              placeholder="Your name"
              style={{ marginBottom: "20px", padding: "5px" }}
            />
            <br />
            <button onClick={() => setHasStarted(true)}>Start Quiz</button>
          </div>
        ) : (
          <> 
            <h2>Score: {score}</h2>
            {showResults ? ( 
              <div className="final-results">
                <h1>Final Results</h1>
                <h2>
                  {score} out of {questions.length} correct - (
                  {(score / questions.length) * 100}%)
                </h2>
                <br />
                <button onClick={() => restartGame()}>Restart game</button> <br></br>
                <Link to="/"><button>Home</button></Link> <br /> 
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
            {feedback && !showResults && (
                <div className="feedback">
                    <p>{feedback}</p>
                    <p>Correct Answer: {questions[currentQuestion]?.options.find(opt => opt.isCorrect)?.text}</p>
                    <p>{questions[currentQuestion]?.answer_explanation}</p>
                </div>
            )}
            {/* Next Question Button */}
            {showNextButton && !showResults && ( 
                  <button onClick={goToNextQuestion}>Next Question</button>
            )}
          </>
        )
      )}
    </div>
  );
}

// APP COMPONENT
function App() {
  const GOOGLE_SHEET_CSV_URL_1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzzNg3HDQK3vUKpEnIwOREwa-SeRIcfYoECkL1qwivnChSUy5xrI7vE8Gpipuo_TxX6YDerL97rfGG/pub?gid=329704009&single=true&output=csv"; 
  const GOOGLE_SHEET_CSV_URL_2 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzzNg3HDQK3vUKpEnIwOREwa-SeRIcfYoECkL1qwivnChSUy5xrI7vE8Gpipuo_TxX6YDerL97rfGG/pub?gid=0&single=true&output=csv"; 

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <div>
              <h1>Air Quality Quizzes</h1>
              <Link to="/basic">Air Quality Basics Quiz</Link> <br /> 
              <Link to="/">Air Quality Advanced Quiz (Coming soon...) </Link> 
            </div>
            }
          />
          
          <Route path="/basic" element={<Quiz googleSheetURL={GOOGLE_SHEET_CSV_URL_1} quizTitle="Air Quality Basics Quiz" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;