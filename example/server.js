const express = require('express');
const path = require('path');
const { Knock } = require('../src/index');

const PORT = process.env.PORT || 3000;

const knock = new Knock({
  rpId:   process.env.KNOCK_RP_ID   || 'localhost',
  rpName: process.env.KNOCK_RP_NAME || 'Knock Demo',
  origin: process.env.KNOCK_ORIGIN  || `http://localhost:${PORT}`,
  dbPath: process.env.KNOCK_DB_PATH || './knock-demo.db',
});

const app = express();
app.use(express.json());
app.use('/auth', knock.router());
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Knock demo running at http://localhost:${PORT}`);
});
