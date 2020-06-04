# Oasis notifier

## Launch app
### Configure environment variable
```bash
cp .env-sample .env
```
Then edit .env to add your values.

### Install dependencies
```bash
npm install 
```

### Run app 
```bash
npm start
```

### Dockerize
```bash
docker build -t plambert/oasis-notifier:latest .
docker-compose up -d
```