# Othello (Reversi) Real-Time Multiplayer Game

Welcome to the **Full-Stack Othello** project! This is a real-time multiplayer implementation of the classic board game Othello (also known as Reversi). 

## 🚀 Project Overview

This project is built using a modern full-stack JavaScript/TypeScript ecosystem. It features real-time matchmaking, an Elo-based ranking system, user authentication, and a fully reactive game board.

The application is split into two main parts:
1. **Frontend:** A React application built with Vite and Tailwind CSS.
2. **Backend:** A Node.js/Express server using Socket.io for real-time communication and MongoDB for data storage.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Build Tool:** Vite
- **Real-time:** Socket.io-client

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (using Mongoose)
- **Real-time:** Socket.io
- **Language:** TypeScript
- **Authentication:** JSON Web Tokens (JWT)

---

## 🧠 Architecture & How It Works (For Your Teacher)

Here is a breakdown of how the different pieces of the project communicate with each other:

### 1. Matchmaking & WebSockets (`backend/src/sockets/gameSocket.ts`)
When a user clicks "Find Match", the frontend opens a WebSocket connection using `Socket.io`. The backend receives this request and places the user in a matchmaking queue. Once two players with similar Elo ratings are found, the server creates a new game room and emits a `gameFound` event to both clients. WebSockets are crucial here because they allow the server to push updates (like opponent moves) to the client instantly without the client needing to refresh the page.

### 2. The Game Engine (`backend/src/gameEngine/othello.ts`)
To prevent cheating, **all game logic is calculated on the server**. 
When a player makes a move, they just send the coordinates `(row, col)` to the backend. The `othello.ts` file acts as the source of truth. It contains pure functions like:
- `getLegalMoves()`: Determines where pieces can be placed.
- `getFlippedPieces()`: Calculates which opponent pieces should be flipped based on the Othello rules (pieces are flipped when they are trapped between the new piece and an existing piece of the same color).
If the move is valid, the server updates the `GameState` and broadcasts the new board to both players.

### 3. The React Frontend (`frontend/src/components/GameBoard.tsx`)
The frontend is completely "reactive". It listens for WebSocket events and simply renders whatever `GameState` the server sends it. 
- The `GameBoard.tsx` component iterates over the 8x8 2D array representing the board.
- It dynamically calculates CSS styles and animations (like the wave delay when multiple pieces flip).
- It only allows the user to click if it's their turn and the move is included in the `legalMoves` array provided by the server.

### 4. Database & Leaderboard
When a game finishes, the server calculates the new Elo ratings for both players using a standard chess Elo formula (`utils/elo.ts`). It then saves the updated ratings and the game history to the MongoDB database using Mongoose models (`models/User.ts` and `models/Game.ts`).

---

## 💻 Running the Project Locally

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas URI)

### Setup Backend
1. `cd backend`
2. `npm install`
3. Create a `.env` file based on `.env.example` and add your MongoDB URI and JWT Secret.
4. `npm run dev`

### Setup Frontend
1. `cd frontend`
2. `npm install`
3. Create a `.env` file based on `.env.example` and set `VITE_API_URL=http://localhost:3000` (or whatever your backend port is).
4. `npm run dev`

---

## 🎯 Key Features to Demo
1. **User Auth:** Show creating an account and logging in.
2. **Real-time Matchmaking:** Open two browser windows, log in as different users, and queue up at the same time to watch them connect.
3. **Gameplay Validation:** Show how the server only allows legal moves and properly calculates the "flips".
4. **Leaderboard:** Finish a game and show how the winner's Elo rating increases on the leaderboard page.
