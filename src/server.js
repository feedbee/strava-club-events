import { app } from './app.js';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

const { port, host } = config;

// Use routes
app.use('/', routes);

// Use error handling middleware
app.use(errorHandler);

// Start server
app.listen(port, host, () => {
  console.log(`🌐 Public URL: ${config.publicUrl}`);
  console.log("✅ Server is running on " + host + ":" + port);
});
