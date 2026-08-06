# Othello (Reversi) Real-Time Multiplayer Game

Welcome to the **Full-Stack Othello** project! This is a real-time multiplayer implementation of the classic board game Othello (also known as Reversi). 

## 🚀 Project Overview

This project features real-time matchmaking, an Elo-based ranking system, user authentication, a web client, and a fully native Android client.

The application is split into three clients/services:
1. **Frontend:** A React application built with Vite and Tailwind CSS.
2. **Backend:** A Node.js/Express server using Socket.io for real-time communication and MongoDB for data storage.
3. **Android:** A fully native Kotlin application built with Jetpack Compose. It does not use a WebView or wrap the website.

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

### Android
- **Language:** Kotlin
- **UI:** Jetpack Compose with a Canvas-rendered 8×8 board
- **Architecture:** Repository + ViewModel + immutable StateFlow UI state
- **Networking:** Native OkHttp REST calls and the Socket.IO Java client with polling/WebSocket upgrade
- **Persistence:** AndroidX DataStore for session restoration
- **Minimum Android version:** Android 8.0 (API 26)
- **Target Android version:** Android 16 (API 36)

---

## 🧠 Architecture & How It Works (For Your Teacher)

Here is a breakdown of how the different pieces of the project communicate with each other:

### 1. Matchmaking & WebSockets (`backend/src/sockets/gameSocket.ts`)
When a user clicks "Find Match", the frontend opens a WebSocket connection using `Socket.io`. The backend receives this request and places the user in a matchmaking queue. Once two players with similar Elo ratings are found, the server creates a new game room and emits a `gameFound` event to both clients. WebSockets are crucial here because they allow the server to push updates (like opponent moves) to the client instantly without the client needing to refresh the page.

Mobile connections may briefly drop when switching between Wi-Fi and cellular data. The backend holds an active game for a 30-second reconnect grace period, lets an authenticated Android client resume the same room and state, and only awards a disconnect win after that deadline.

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

### Build the Native Android App
1. Install JDK 17 and Android SDK 36.
2. `cd android`
3. Build and test the debug app: `./gradlew testDebugUnitTest assembleDebug` (Windows: `gradlew.bat testDebugUnitTest assembleDebug`).
4. The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

The debug build connects to `http://10.0.2.2:4000`, which is the host computer from an Android emulator. Start the backend locally on port 4000 before using login or multiplayer features.

To test a debug build on a physical phone against a deployed server, override both endpoints:

```bash
./gradlew assembleDebug \
  -POTHELLO_DEBUG_API_URL=https://your-api.example.com/api \
  -POTHELLO_DEBUG_SOCKET_URL=https://your-api.example.com
```

For a production build, provide the deployed backend addresses:

```bash
./gradlew assembleRelease \
  -POTHELLO_API_URL=https://your-api.example.com/api \
  -POTHELLO_SOCKET_URL=https://your-api.example.com
```

The release build enables R8 code shrinking and resource optimization. Configure a private signing key before publishing the APK or an Android App Bundle to Google Play.

---

## 🎯 Key Features to Demo
1. **User Auth:** Show creating an account and logging in.
2. **Real-time Matchmaking:** Open two browser windows, log in as different users, and queue up at the same time to watch them connect.
3. **Gameplay Validation:** Show how the server only allows legal moves and properly calculates the "flips".
4. **Leaderboard:** Finish a game and show how the winner's Elo rating increases on the leaderboard page.
5. **Native Android:** Show guest/login/register, ranked matchmaking, private room codes, the native Canvas board, resign/rematch, leaderboard, rotation-safe state, and reconnect recovery.
