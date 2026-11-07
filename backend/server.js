require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const blockRouter = require("./routes/block");

// body-parser - json
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "X-Mail-Status");
  next();
});

app.use(blockRouter);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`PORT:${port}`);
  console.log(
    process.env.RESEND_API_KEY
      ? `Emailing a copy of each SEND to ${process.env.MAIL_TO}`
      : "Email copies off (no RESEND_API_KEY in backend/.env)"
  );
});
