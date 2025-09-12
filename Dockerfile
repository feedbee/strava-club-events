# Use Node.js LTS
FROM node:18

# Update all packages
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get autoremove -y \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*


# Set app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json if present
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Expose port (matches server.js)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
