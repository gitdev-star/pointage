FROM node:18-alpine

WORKDIR /app

# Copy package.json ONLY
COPY package.json ./

# Install dependencies (this installs react-scripts)
RUN npm install

# Copy the rest of the frontend
COPY . .

EXPOSE 3000

CMD ["npm", "start"]

