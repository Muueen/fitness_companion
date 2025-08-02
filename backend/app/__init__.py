from flask import Flask
from .extensions import mongo, jwt
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.Config")

    CORS(app)
    mongo.init_app(app)
    jwt.init_app(app)

    from .auth.routes import auth_bp
    app.register_blueprint(auth_bp)

    # Other blueprints: workouts_bp, calculators_bp, etc.

    return app
