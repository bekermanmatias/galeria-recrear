const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the Backend!' });
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
