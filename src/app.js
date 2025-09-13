import express from "express";
import session from "express-session";
import { config } from "./config/index.js";

// Create Express app
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static("public"));

// Export the app
export { app };
