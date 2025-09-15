import express from "express";
import { sessionMiddleware } from "./middleware/session.middleware.js";

// Create Express app
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(express.static("public"));

// Export the app
export { app };
