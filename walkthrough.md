# IAM System Walkthrough

This document guides you through running and testing the Identity and Access Management (IAM) system.

## 1. Prerequisites
- Node.js installed.
- MongoDB running locally on default port `27017`.

## 2. Setup
The project is already set up. If you haven't installed dependencies yet:
```bash
npm install
```

To seed the database with a demo OAuth app and an Admin User:
```bash
node seed.js
```
*   **Admin User**: `admin_user` / `password123`
*   **Standard User**: `standard_user` / `password123` (Has shared access to admin token)

## 3. Running the System (Split Architecture)
You will need **two** terminal windows.

**Terminal 1: IAM System (Port 3000)**
```bash
npm run dev
# Or: node server.js
```

**Terminal 2: Client App (Port 3001)**
```bash
npm run client
# Or: nodemon client_app.js
```

## 4. Testing the Flow
1.  Open `http://localhost:3001` (The Client App).
2.  Click **Connect with IAM System**.
3.  You will be redirected to `localhost:3000` to Login/Authorize.
4.  After approval, you are redirected back to `localhost:3001/dashboard`.
5.  Success! The app on Port 3001 is showing data from Port 3000.

### 4.1 User Registration & Login
1.  Open `http://localhost:3000`.
2.  Click **Register** and create an account.
3.  Login with your new account.
4.  A **"Launch Dashboard"** button will appear. Click it to authorize the app and enter the system.

### 4.2 OAuth2 Authorization Flow
To test the OAuth2 flow, construct the following URL in your browser (after logging in):

```
http://localhost:3000/oauth/authorize?response_type=code&client_id=demo-client-id&redirect_uri=http://localhost:3000/callback&scope=files:read files:write&state=xyz
```

1.  You should see a **Consent Screen** asking for permission for "Demo App".
2.  Click **Allow**.
3.  You will be redirected to `http://localhost:3000/callback?code=AUTH_CODE_HERE&state=xyz`.
    *   *Note: Since `/callback` doesn't exist in our app, you will see a "Cannot GET /callback" error, but check the URL bar for the `code` parameter.*

### 4.3 Dashboard Access
1.  After approving consent, you will be automatically redirected to `/dashboard`.
2.  Authenticated by your OAuth Token, this page lists your files.
3.  **Try it**:
    *   **Create a File**: Use the form on the right.
    *   **Share a File**: Type `standard_user` (or another username) in the Share box next to a file and click Share.

*(Note: The manual steps below are for understanding the underlying API calls that the Dashboard is making for you.)*

### 4.4 Manual Token Exchange (Optional)
If you want to see the raw flow as before:
Use `curl` or Postman to exchange the code for a token:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "013de308927ff0ff5a746b33bda7b5e1cb7030a0",
    "redirect_uri": "http://localhost:3000/callback",
    "client_id": "demo-client-id",
    "client_secret": "demo-client-secret"
  }'
```

**Response:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 4.4 Accessing User Info
Use the access token to get user details:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjk1N2RmOGM3N2EzNDI4MTk3Y2QxZWNiIiwiY2xpZW50X2lkIjoiZGVtby1jbGllbnQtaWQiLCJyb2xlcyI6WyJ1c2VyIl0sInNjb3BlIjpbImZpbGVzOnJlYWQiLCJwcm9maWxlOnJlYWQiXSwiaWF0IjoxNzY3MzY2NTc3LCJleHAiOjE3NjczNzAxNzd9.mItwtSh4dsVQPDsnQ6OvVeVn0e5maPMgrtsSRqmYAgc" http://localhost:3000/oauth/userinfo
```

**Response:**
```json
{
  "sub": "USER_ID",
  "username": "YOUR_USERNAME"
}
```

### 4.5 Accessing Protected Resources (Files)

To Verify Success (Read Files):
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjk1N2UxNzBhMDBhZjYzYWVhN2U4ZjIzIiwiY2xpZW50X2lkIjoiZGVtby1jbGllbnQtaWQiLCJyb2xlcyI6WyJ1c2VyIl0sInNjb3BlIjpbImZpbGVzOnJlYWQiLCJwcm9maWxlOnJlYWQiXSwiaWF0IjoxNzY3MzY3MDcxLCJleHAiOjE3NjczNzA2NzF9.VFCk13tmdSwOIVIonzS8YksTa6XhVh4D2LLHbZXpv_o" http://localhost:3000/api/files
```

To Verify Forbidden (Write Files without permission):
```bash
curl -X POST -H "Authorization: Bearer YOUR_ACCESS_TOKEN" http://localhost:3000/api/files
```

### 4.6 Sharing a File (User-Driven)
If you own a file (e.g., you created one or are the admin), you can share it:

```bash
curl -X POST http://localhost:3000/api/files/FILE_ID/share \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "standard_user"}'
```

## 5. Troubleshooting

### MongoDB Connection Error
If you see an error like `Error: connect ECONNREFUSED 127.0.0.1:27017`, it means the application cannot connect to the MongoDB database.

**Solution:**
Ensure your MongoDB server is running.
- **Windows:** Run `net start MongoDB` in an Administrator terminal, or check "Services" to start the MongoDB service.
- **Linux/Mac:** Run `sudo systemctl start mongod` or `brew services start mongodb-community`.
- **Docker:** If you prefer Docker, you can start a container: `docker run -d -p 27017:27017 --name mongodb mongo:latest`
