from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
import re
from datetime import timedelta
from ..extensions import mongo

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Extract required fields
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        full_name = data.get('fullName', '').strip()
        age = data.get('age')
        gender = data.get('gender', '').strip()
        weight = data.get('weight')
        height = data.get('height')
        fitness_level = data.get('fitnessLevel', '').strip()
        fitness_goals = data.get('fitnessGoals', [])
        medical_conditions = data.get('medicalConditions', '').strip()
        preferred_units = data.get('preferredUnits', 'metric')
        target_weight = data.get('targetWeight')
        
        # Validation
        errors = {}
        
        # Email validation
        if not email:
            errors['email'] = 'Email is required'
        elif not validate_email(email):
            errors['email'] = 'Please enter a valid email address'
        else:
            # Check if email already exists
            existing_user = mongo.db.users.find_one({'email': email})
            if existing_user:
                errors['email'] = 'Email already registered'
        
        # Password validation
        if not password:
            errors['password'] = 'Password is required'
        else:
            is_valid, message = validate_password(password)
            if not is_valid:
                errors['password'] = message
        
        # Other required fields
        if not full_name:
            errors['fullName'] = 'Full name is required'
        
        if not age or age < 13 or age > 120:
            errors['age'] = 'Please enter a valid age (13-120)'
        
        if not gender:
            errors['gender'] = 'Gender is required'
        
        if not weight or weight <= 0:
            errors['weight'] = 'Valid weight is required'
        
        if not height or height <= 0:
            errors['height'] = 'Valid height is required'
        
        if not fitness_level:
            errors['fitnessLevel'] = 'Fitness level is required'
        
        if not fitness_goals or len(fitness_goals) == 0:
            errors['fitnessGoals'] = 'Please select at least one fitness goal'
        
        # If there are validation errors, return them
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        
        # Hash password
        hashed_password = generate_password_hash(password)
        
        # Create user document
        user_data = {
            'email': email,
            'password': hashed_password,
            'full_name': full_name,
            'age': int(age),
            'gender': gender,
            'weight': float(weight),
            'height': float(height),
            'fitness_level': fitness_level,
            'fitness_goals': fitness_goals,
            'medical_conditions': medical_conditions,
            'preferred_units': preferred_units,
            'target_weight': float(target_weight) if target_weight else None,
            'created_at': mongo.db.users.find_one({}, {'_id': 1}) is None,  # First user is admin
            'is_active': True,
            'profile_complete': True
        }
        
        # Insert user into database
        result = mongo.db.users.insert_one(user_data)
        
        # Create JWT token
        access_token = create_access_token(
            identity=str(result.inserted_id),
            expires_delta=timedelta(days=7)
        )
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'Registration successful!',
            'token': access_token,
            'user': {
                'id': str(result.inserted_id),
                'email': email,
                'full_name': full_name,
                'fitness_level': fitness_level
            }
        }), 201
        
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred during registration'
        }), 500

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not email:
            return jsonify({
                'success': False,
                'message': 'Email is required'
            }), 400
        
        if not password:
            return jsonify({
                'success': False,
                'message': 'Password is required'
            }), 400
        
        # Find user by email
        user = mongo.db.users.find_one({'email': email})
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Check if user is active
        if not user.get('is_active', True):
            return jsonify({
                'success': False,
                'message': 'Account is deactivated'
            }), 401
        
        # Verify password
        if not check_password_hash(user['password'], password):
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Create JWT token
        access_token = create_access_token(
            identity=str(user['_id']),
            expires_delta=timedelta(days=7)
        )
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'Login successful!',
            'token': access_token,
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'full_name': user['full_name'],
                'fitness_level': user.get('fitness_level', ''),
                'fitness_goals': user.get('fitness_goals', []),
                'preferred_units': user.get('preferred_units', 'metric')
            }
        }), 200
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred during login'
        }), 500

@auth_bp.route('/api/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Remove sensitive data
        user.pop('password', None)
        user['_id'] = str(user['_id'])
        
        return jsonify({
            'success': True,
            'user': user
        }), 200
        
    except Exception as e:
        print(f"Profile error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred while fetching profile'
        }), 500

@auth_bp.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    # In a real application, you might want to blacklist the token
    # For now, we'll just return a success message
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200

@auth_bp.route('/api/auth/calculate-health-metrics', methods=['GET'])
@jwt_required()
def calculate_health_metrics():
    try:
        user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Extract user data
        weight = user.get('weight')
        height = user.get('height')
        age = user.get('age')
        gender = user.get('gender')
        
        if not all([weight, height, age, gender]):
            return jsonify({
                'success': False,
                'message': 'Incomplete user data for calculations'
            }), 400
        
        # Convert height from cm to meters
        height_in_meters = height / 100
        
        # Calculate BMI: BMI = weight(kg) / height(m)^2
        bmi = weight / (height_in_meters * height_in_meters)
        
        # Calculate Body Fat Percentage: BFP = 1.20⋅BMI + 0.23⋅age − 10.8⋅gender − 5.4
        # Gender: 1 for male, 0 for female
        gender_value = 1 if gender.lower() == 'male' else 0
        bfp = 1.20 * bmi + 0.23 * age - 10.8 * gender_value - 5.4
        
        # Determine BMI category
        if bmi < 18.5:
            bmi_category = 'Underweight'
        elif bmi < 25:
            bmi_category = 'Normal weight'
        elif bmi < 30:
            bmi_category = 'Overweight'
        else:
            bmi_category = 'Obese'
        
        # Determine BFP category
        if gender_value == 1:  # Male
            if bfp < 6:
                bfp_category = 'Essential fat'
            elif bfp < 14:
                bfp_category = 'Athletes'
            elif bfp < 18:
                bfp_category = 'Fitness'
            elif bfp < 25:
                bfp_category = 'Average'
            else:
                bfp_category = 'Obese'
        else:  # Female
            if bfp < 14:
                bfp_category = 'Essential fat'
            elif bfp < 21:
                bfp_category = 'Athletes'
            elif bfp < 25:
                bfp_category = 'Fitness'
            elif bfp < 32:
                bfp_category = 'Average'
            else:
                bfp_category = 'Obese'
        
        return jsonify({
            'success': True,
            'metrics': {
                'bmi': round(bmi, 2),
                'bfp': round(bfp, 2),
                'bmi_category': bmi_category,
                'bfp_category': bfp_category,
                'user_data': {
                    'weight': weight,
                    'height': height,
                    'age': age,
                    'gender': gender
                }
            }
        }), 200
        
    except Exception as e:
        print(f"Health metrics calculation error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred while calculating health metrics'
        }), 500

@auth_bp.route('/api/auth/test')
def test_auth():
    return jsonify({'message': 'Auth blueprint working'}) 