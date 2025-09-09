class Config:
    SECRET_KEY = "super-secret"
    MONGO_URI = "mongodb+srv://mahfuzulmueen_db_user:Abcabc123@cluster0.xwp7h3w.mongodb.net/fitness-companion?retryWrites=true&w=majority&appName=Cluster0"
    JWT_SECRET_KEY = "jwt-secret"
    # OpenAI API key is expected via environment variable for security
    # Set OPENAI_API_KEY in your environment before running the server
