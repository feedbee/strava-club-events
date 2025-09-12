FROM node:18

# Update all packages and install common dev tools
RUN apt-get update \
&& apt-get upgrade -y \
&& apt-get autoremove -y \
&& apt-get clean \
&& rm -rf /var/lib/apt/lists/* \
&& apt-get install -y git curl \
&& rm -rf /var/lib/apt/lists/*

# Set working dir
WORKDIR /workspace

# Copy only package.json first to speed up rebuilds
COPY package*.json ./
RUN npm install

# Copy everything (source will also be mounted by VS Code)
COPY . .

EXPOSE 3000
