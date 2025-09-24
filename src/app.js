import express from "express";
import { secureSessionMiddleware } from "./middleware/session.middleware.js";

// Create Express app
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use secure session middleware (includes encryption for sensitive data)
app.use(secureSessionMiddleware);

// Static files
app.use(express.static("public"));

// Export the app
export { app };
