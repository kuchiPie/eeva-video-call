# Eeva - Video Call Application

Eeva is a peer-to-peer video calling application built with Next.js for the frontend and Go for the signaling server. It uses WebRTC for real-time communication between users.

## Features

- Real-time video and audio communication
- Peer-to-peer connection using WebRTC
- Simple user interface with unique user codes for connection
- STUN/TURN server integration for NAT traversal

## Project Structure

- `/server` - Go signaling server
- `/ui` - Next.js frontend application

## Prerequisites

- Go 1.16 or higher
- Node.js 14 or higher
- npm or yarn

## Installation

### Server Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install Go dependencies:
   ```
   go mod tidy
   ```

3. Build the server:
   ```
   go build -o eeva-server
   ```

4. Run the server:
   ```
   ./eeva-server
   ```
   
   The server will start on port 8080.

### UI Setup

1. Navigate to the UI directory:
   ```
   cd ui
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the UI directory with the following content:
   ```
   NEXT_PUBLIC_SERVER_URL=http://localhost:8080
   ```
   
   Note: Adjust the URL if your server is running on a different host or port.

4. Start the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. When you open the application, you'll be assigned a unique code.
2. Share this code with the person you want to call.
3. Enter their code in the input field and click "Connect".
4. Once connected, you should be able to see and hear each other.

## Environment Variables

### Backend (.env file in server directory)
- `PORT`: Server port (default: 8080)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins
- `TURN_SERVER_URLS`: Comma-separated list of TURN server URLs
- `TURN_USERNAME`: TURN server username
- `TURN_CREDENTIAL`: TURN server credential

### Frontend (.env.local file in ui directory)
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_TURN_SERVER_URL_1`: Primary TURN server URL
- `NEXT_PUBLIC_TURN_SERVER_URL_2`: TURN server URL with TCP transport
- `NEXT_PUBLIC_TURN_SERVER_URL_3`: TURN server URL with port 443
- `NEXT_PUBLIC_TURN_SERVER_URL_4`: TURN server URL with port 443 and TCP transport
- `NEXT_PUBLIC_TURN_USERNAME`: TURN server username
- `NEXT_PUBLIC_TURN_CREDENTIAL`: TURN server credential

## Deployment

### Server Deployment

The Go server can be deployed to any platform that supports Go applications, such as:
- Render
- Heroku
- AWS
- Google Cloud Platform

### UI Deployment

The Next.js application can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Troubleshooting

- If you're having connection issues, ensure both users have allowed camera and microphone permissions in their browsers.
- WebRTC requires HTTPS in production environments. Make sure your deployed application uses HTTPS.
- If you're behind a restrictive firewall or NAT, the TURN server configuration might need adjustment.

## License

This project is licensed under the MIT License.
