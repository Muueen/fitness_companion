class Config:
    SECRET_KEY = "super-secret"
    MONGO_URI = "mongodb://localhost:27017/fitness_companion"
    JWT_SECRET_KEY = "jwt-secret"
    # OpenAI API key is expected via environment variable for security
    # Set OPENAI_API_KEY in your environment before running the server
