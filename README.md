docker run -d -p 27017:27017 mongo:latest
cd iam_server
node seed.js
npm run dev


docker run -d -p 27018:27017 mongo:latest
cd client_app
npm run client


Git Bash in Terminal
- Command Line: C:\Program Files\Git\bin\bash.exe

