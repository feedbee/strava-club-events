import { app } from './app.js';
import { config } from './config/index.js';
import routes from './routes/index.js';

const { port } = config;

// Use routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
