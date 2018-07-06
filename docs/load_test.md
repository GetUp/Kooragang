# Load Testing

### Running the Load Tester
#### 1) Start your local tunnel
-  local tunnel script location `./tunnel.js`
- command to run local tunnel `npm run local-tunnel`

#### 2) Run the load tester
---
##### env vars
`PGSSLMODE=require ` - Required

`PORT=5000` - Default port opened by local tunnel script

`BASE_URL=https://tech-member-kooragang.ngrok.io` - Your ngrok domain

`TARGET='61285994346'` - Default staging phone number

`LOADTEST_DATABASE_URL='postgresql://...'` - The PSQL URL to the staging database

`PLIVO_API_ID=XXXXXXXXXXXXX` - Plivo Creds

`PLIVO_API_TOKEN=XXXXXXXXXXXXX` - Plivo Creds

---

- load testing script location `./load/index.js` 
- command to run local tunnel `[env_vars] node ./load`