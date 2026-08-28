import React, { useEffect, useState } from "react";
import "./App.css";
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
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
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const selected_questions = questions.slice(0, 10);
  return selected_questions;
}

// Helper function to convert Scores CSV to objects
function csvToScores(csvString) {
  const lines = csvString.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace("\r", ""));
  const scores = [];
  
  const quizIdx = headers.indexOf('quizName');
  const scoreIdx = headers.indexOf('score');
  const dateIdx = headers.indexOf('date');
  
  let nameIdx = headers.indexOf('name');
  if (nameIdx === -1) {
    nameIdx = headers.indexOf('user');
  }

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    
    if (values.length >= 3) { 
      scores.push({
        quiz: quizIdx !== -1 && values[quizIdx] ? values[quizIdx].replace("\r", "") : '',
        name: nameIdx !== -1 && values[nameIdx] ? values[nameIdx].replace("\r", "") : '',
        score: scoreIdx !== -1 && values[scoreIdx] ? parseInt(values[scoreIdx], 10) || 0 : 0,
        date: dateIdx !== -1 && values[dateIdx] ? values[dateIdx].replace("\r", "") : ''
      });
    }
  }
  return scores;
}

// LEADERBOARD COMPONENT
function Leaderboard({ googleSheetURL }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
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
        const data = csvToScores(csvData);
        setScores(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching leaderboard CSV file:", error);
        setLoading(false);
      });
  }, [googleSheetURL]);

  const filteredScores = scores.filter(entry => {
    const entryName = entry.name || "";
    
    if (!entryName || /^\d/.test(entryName)) {
      return false;
    }

    if (entry.date) {
      const entryDate = new Date(entry.date);
      if (startDate && new Date(startDate) > entryDate) {
        return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (end < entryDate) {
          return false;
        }
      }
    }

    return true;
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="quiz-container">
      <h1>Leaderboard</h1>
      
      <div className="date-filters" style={{ marginBottom: "20px" }}>
        <label style={{ marginRight: "10px" }}>
          Start Date:
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            style={{ marginLeft: "5px" }}
          />
        </label>
        <label>
          End Date:
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            style={{ marginLeft: "5px" }}
          />
        </label>
      </div>

      {loading ? (
        <h2>Loading leaderboard...</h2>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <table 
            style={{ 
              width: "80%", 
              borderCollapse: "collapse", 
              textAlign: "left", 
              margin: "20px 0" 
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc" }}>
                <th style={{ padding: "15px" }}>Rank</th>
                <th style={{ padding: "15px" }}>Name</th>
                <th style={{ padding: "15px" }}>Score</th>
                <th style={{ padding: "15px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredScores.length > 0 ? (
                filteredScores.map((entry, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "15px" }}>{index + 1}</td>
                    <td style={{ padding: "15px" }}>{entry.name}</td>
                    <td style={{ padding: "15px" }}>{entry.score}</td>
                    <td style={{ padding: "15px" }}>{entry.date ? new Date(entry.date).toLocaleDateString() : "N/A"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: "10px", textAlign: "center" }}>No results found for the selected dates.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Link to="/"><button>Back to Home</button></Link>
    </div>
  );
}

// QUIZ COMPONENT (reusable)
function Quiz({ googleSheetURL, quizTitle }) {
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
      });
  };

  const optionClicked = (isCorrect, option) => {
    if (selectedOption) return; // Prevent multiple selections per question

    setResponses(prev => [...prev, option.id]);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback("Correct :) !");
    } else {
      setFeedback("Incorrect :( ");
    }  
    
    setSelectedOption(option); 
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
      <p>Each quiz has 10 questions selected from a pool of questions. Participants are encouraged to take the test multiple times</p>
      
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
                  setHasStarted(true); 
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
                <button onClick={() => restartGame()}>Restart game</button> <br />
                <Link to="/"><button>Home</button></Link> <br /> 
              </div>  
            ) : (
              <div className="question-card">
                <h2>
                  Question: {currentQuestion + 1} out of {questions.length}
                </h2>
                <h3 className="question-text">{questions[currentQuestion]?.text}</h3>
                <ul>
                  {questions[currentQuestion]?.options.map((option) => {
                    const isSelected = selectedOption?.id === option.id;
                    
                    // Dynamic background: light green if selected & correct, light red if selected & wrong
                    let bgColor = "rgba(255, 255, 255, 0.86)";
                    if (isSelected) {
                      bgColor = option.isCorrect ? "#a8e6cf" : "#ff8b94";
                    }

                    return (
                      <li
                        key={option.id}
                        onClick={() => optionClicked(option.isCorrect, option)}
                        style={{
                          backgroundColor: bgColor,
                          cursor: selectedOption ? "default" : "pointer",
                          transform: isSelected ? "scale(1.02)" : "scale(1)",
                          transition: "all 0.2s ease"
                        }}
                      >
                        {option.text}
                      </li>
                    );
                  })}
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
  const GOOGLE_SHEET_SCORES_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzzNg3HDQK3vUKpEnIwOREwa-SeRIcfYoECkL1qwivnChSUy5xrI7vE8Gpipuo_TxX6YDerL97rfGG/pub?gid=1164938647&single=true&output=csv"; 

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <div>
              <h1>Air Quality Quizzes</h1>
              <Link to="/basic">Air Quality Basics Quiz</Link> <br /> 
              <Link to="/">Air Quality Advanced Quiz (Coming soon...) </Link> <br /><br />
              <Link to="/leaderboard"><button>View Leaderboard</button></Link> 
            </div>
          }
          />
          <Route path="/basic" element={<Quiz googleSheetURL={GOOGLE_SHEET_CSV_URL_1} quizTitle="Air Quality Basics Quiz" />} />
          <Route path="/leaderboard" element={<Leaderboard googleSheetURL={GOOGLE_SHEET_SCORES_URL} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;