from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
import openai
from ..extensions import mongo
from . import workouts_bp

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENROUTER_API_KEY")
openai.api_base = "https://openrouter.ai/api/v1"

if not openai.api_key:
    raise RuntimeError("OpenRouter API key not configured in .env")

def build_prompt(user, start_date_iso):
    """Build deterministic JSON prompt for a 7-day workout plan with time."""
    age = user.get("age")
    weight = user.get("weight")
    height = user.get("height")
    fitness_level = user.get("fitness_level")
    goals = user.get("fitness_goals", [])
    medical = user.get("medical_conditions", "")
    equipment = user.get("equipment", [])
    time_per_session = user.get("time_per_session", 45)

    start_dt = datetime.fromisoformat(start_date_iso)
    dates = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d (%A)") for i in range(7)]

    schema_example = {
        dates[0]: {
            "time": "7:00 AM",
            "exercises": ["Push-ups 3x12", "Bench Press 3x10"]
        }
    }

    system_msg = (
        "You are a strict JSON generator for fitness plans. Return ONLY valid JSON without any extra commentary. "
        "No markdown, no code fences, no explanations. Ensure valid JSON parseable by Python json.loads."
    )

    user_msg = (
        f"Generate a 7-day personalized workout plan starting from {dates[0]} for a user:\n"
        f"- Age: {age}\n- Weight: {weight} kg\n- Height: {height} cm\n"
        f"- Fitness level: {fitness_level}\n- Goals: {', '.join(goals) if goals else ''}\n"
        f"- Injuries/medical considerations: {medical or 'None'}\n"
        f"- Available equipment: {', '.join(equipment) if equipment else 'Bodyweight only'}\n"
        f"- Available time per session: {time_per_session} minutes\n\n"
        "Requirements:\n"
        "- Use EXACTLY these date keys:\n"
        + "\n".join([f"  - {d}" for d in dates]) + "\n"
        "- For each date, include:\n"
        "  - \"time\": single time like '7:00 AM'\n"
        "  - \"exercises\": array of strings like 'Squats 3x12'\n"
        "- Keep workouts aligned with fitness level and injuries.\n"
        "- Keep within available time.\n"
        "- Respond ONLY with JSON.\n\n"
        "JSON example format:\n" + json.dumps(schema_example)
    )

    return system_msg, user_msg, dates


@workouts_bp.route('/generate-workout', methods=['POST'])
@jwt_required()
def generate_workout():
    """Generate a 7-day workout plan using OpenRouter and store it for the user."""
    try:
        user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        payload = request.get_json(silent=True) or {}
        start_date_str = payload.get('start_date')
        if not start_date_str:
            start_date_str = datetime.now().strftime('%Y-%m-%d')
        start_date_iso = f"{start_date_str}T00:00:00"

        if 'time_per_session' in payload:
            user['time_per_session'] = payload.get('time_per_session')

        system, user_prompt, dates = build_prompt(user, start_date_iso)

        # OpenRouter key from environment
        OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")
        if not OPENROUTER_KEY:
            return jsonify({'success': False, 'message': 'OpenRouter API key not configured'}), 500

        # Call OpenRouter API
        import requests
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2
        }

        response = requests.post(url, headers=headers, json=body)
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'message': f"OpenRouter API error: {response.status_code}",
                'details': response.text
            }), response.status_code

        content = response.json()["choices"][0]["message"]["content"]

        # Try to parse strict JSON
        try:
            plan = json.loads(content)
        except json.JSONDecodeError:
            # Cleanup if model added code fences
            cleaned = content.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.strip('`')
                if cleaned.startswith('json'):
                    cleaned = cleaned[4:]
            try:
                plan = json.loads(cleaned)
            except Exception:
                return jsonify({
                    'success': False,
                    'message': 'Model returned invalid JSON',
                    'raw': content
                }), 502

        # Validate required keys present
        missing = [d for d in dates if d not in plan]
        if missing:
            return jsonify({
                'success': False,
                'message': 'Generated plan missing expected dates',
                'missing_dates': missing,
                'plan': plan
            }), 502

        # Upsert plan to database
        doc = {
            'user_id': ObjectId(user_id),
            'start_date': start_date_str,
            'plan': plan,
            'created_at': datetime.utcnow()
        }
        mongo.db.workout_plans.update_one(
            {'user_id': ObjectId(user_id), 'start_date': start_date_str},
            {'$set': doc},
            upsert=True
        )

        return jsonify({'success': True, 'plan': plan, 'start_date': start_date_str, 'statuses': {}, 'change_requests': []}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@workouts_bp.route('/workout-day-status', methods=['POST'])
@jwt_required()
def set_workout_day_status():
    """Mark a specific day in the plan as done or missed."""
    try:
        user_id = get_jwt_identity()
        payload = request.get_json(silent=True) or {}
        start_date = payload.get('start_date')
        date_key = payload.get('date_key')  # e.g., "2025-08-24 (Sunday)"
        status = payload.get('status')  # 'done' | 'missed'

        if status not in {'done', 'missed'}:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        if not date_key:
            return jsonify({'success': False, 'message': 'date_key is required'}), 400

        query = {'user_id': ObjectId(user_id)}
        if start_date:
            query['start_date'] = start_date

        doc = mongo.db.workout_plans.find_one(query, sort=[('created_at', -1)])
        if not doc:
            return jsonify({'success': False, 'message': 'No workout plan found'}), 404

        # Ensure statuses map exists
        statuses = doc.get('statuses', {})
        statuses[date_key] = status

        mongo.db.workout_plans.update_one(
            {'_id': doc['_id']},
            {'$set': {'statuses': statuses, 'updated_at': datetime.utcnow()}}
        )

        return jsonify({'success': True, 'statuses': statuses}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@workouts_bp.route('/workout-change', methods=['POST'])
@jwt_required()
def request_workout_change():
    """Record a change request for a specific exercise on a given day."""
    try:
        user_id = get_jwt_identity()
        payload = request.get_json(silent=True) or {}
        start_date = payload.get('start_date')
        date_key = payload.get('date_key')
        exercise = payload.get('exercise')  # exact string to be changed
        reason = payload.get('reason')  # optional

        if not date_key or not exercise:
            return jsonify({'success': False, 'message': 'date_key and exercise are required'}), 400

        query = {'user_id': ObjectId(user_id)}
        if start_date:
            query['start_date'] = start_date

        doc = mongo.db.workout_plans.find_one(query, sort=[('created_at', -1)])
        if not doc:
            return jsonify({'success': False, 'message': 'No workout plan found'}), 404

        change_requests = doc.get('change_requests', [])
        change_requests.append({
            'date_key': date_key,
            'exercise': exercise,
            'reason': reason,
            'requested_at': datetime.utcnow()
        })

        mongo.db.workout_plans.update_one(
            {'_id': doc['_id']},
            {'$set': {'change_requests': change_requests, 'updated_at': datetime.utcnow()}}
        )

        return jsonify({'success': True, 'change_requests': change_requests}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def build_modify_prompt(doc):
    """Build a deterministic JSON-only prompt to modify an existing plan."""
    current_plan = doc.get('plan', {})
    statuses = doc.get('statuses', {})
    change_requests = doc.get('change_requests', [])
    start_date = doc.get('start_date')

    # Ensure consistent date ordering
    try:
        ordered_keys = sorted(current_plan.keys(), key=lambda k: datetime.strptime(k.split(' ')[0], '%Y-%m-%d'))
    except Exception:
        ordered_keys = list(current_plan.keys())

    system_msg = (
        "You strictly output ONLY valid JSON (no markdown or commentary). "
        "You will modify a 7-day workout plan based on statuses and change requests."
    )

    # Ensure change_requests datetimes are serializable
    def _serialize_change_requests(reqs):
        safe = []
        for r in reqs:
            r_safe = dict(r)
            ra = r_safe.get('requested_at')
            try:
                if ra is not None and hasattr(ra, 'isoformat'):
                    r_safe['requested_at'] = ra.isoformat()
            except Exception:
                r_safe['requested_at'] = str(ra)
            safe.append(r_safe)
        return safe

    instructions = {
        'start_date': start_date,
        'rules': [
            'Keep the plan 7 days long using the SAME date keys as provided.',
            'Days marked as done must remain unchanged.',
            'Reschedule workouts from days marked as missed into the remaining days while keeping volume/time reasonable.',
            'For each change request, replace the specified exercise with a close, safer alternative targeting similar muscles.',
            'Maintain "time" per day and ensure exercises are realistic and safe.',
            'Return the FULL updated plan object keyed by the same dates with fields: time, exercises (array of strings).'
        ],
        'current_plan': {k: current_plan[k] for k in ordered_keys},
        'statuses': statuses,
        'change_requests': _serialize_change_requests(change_requests),
        'example_day': {
            'time': '7:00 AM',
            'exercises': ['Squats 3x12', 'Push-ups 3x15']
        }
    }

    user_msg = (
        "Modify this plan according to rules. Respond with JSON of the full plan only.\n\n"
        + json.dumps(instructions)
    )

    return system_msg, user_msg, ordered_keys


@workouts_bp.route('/modify-workout-plan', methods=['POST'])
@jwt_required()
def modify_workout_plan():
    """Use AI to reschedule missed days and apply exercise alternatives, then save."""
    try:
        user_id = get_jwt_identity()
        payload = request.get_json(silent=True) or {}
        start_date = payload.get('start_date')

        query = {'user_id': ObjectId(user_id)}
        if start_date:
            query['start_date'] = start_date

        doc = mongo.db.workout_plans.find_one(query, sort=[('created_at', -1)])
        if not doc:
            return jsonify({'success': False, 'message': 'No workout plan found'}), 404

        system, user_prompt, expected_dates = build_modify_prompt(doc)

        # Call OpenRouter API
        OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")
        if not OPENROUTER_KEY:
            return jsonify({'success': False, 'message': 'OpenRouter API key not configured'}), 500

        import requests
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2
        }

        response = requests.post(url, headers=headers, json=body)
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'message': f"OpenRouter API error: {response.status_code}",
                'details': response.text
            }), response.status_code

        content = response.json()["choices"][0]["message"]["content"]

        # Parse JSON
        try:
            new_plan = json.loads(content)
        except json.JSONDecodeError:
            cleaned = content.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.strip('`')
                if cleaned.startswith('json'):
                    cleaned = cleaned[4:]
            new_plan = json.loads(cleaned)

        missing = [d for d in expected_dates if d not in new_plan]
        if missing:
            return jsonify({
                'success': False,
                'message': 'Modified plan missing expected dates',
                'missing_dates': missing,
                'plan': new_plan
            }), 502

        # Save updated plan, and clear change_requests; keep statuses for audit
        mongo.db.workout_plans.update_one(
            {'_id': doc['_id']},
            {'$set': {
                'plan': new_plan,
                'change_requests': [],
                'modified_at': datetime.utcnow()
            }}
        )

        return jsonify({'success': True, 'plan': new_plan, 'start_date': doc.get('start_date')}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500



@workouts_bp.route('/workout-plan', methods=['GET'])
@jwt_required()
def get_workout_plan():
    """Fetch a stored 7-day workout plan for the user by start_date or latest."""
    try:
        user_id = get_jwt_identity()
        start_date = request.args.get('start_date')

        query = {'user_id': ObjectId(user_id)}
        if start_date:
            query['start_date'] = start_date

        # Use find_one with sort to get the latest if start_date not specified
        doc = mongo.db.workout_plans.find_one(query, sort=[('created_at', -1)])

        if not doc:
            return jsonify({'success': False, 'message': 'No workout plan found'}), 404

        # Serialize change_requests datetimes to ISO strings
        cr = doc.get('change_requests', [])
        cr_safe = []
        for r in cr:
            r_safe = dict(r)
            ra = r_safe.get('requested_at')
            try:
                if ra is not None and hasattr(ra, 'isoformat'):
                    r_safe['requested_at'] = ra.isoformat()
            except Exception:
                r_safe['requested_at'] = str(ra)
            cr_safe.append(r_safe)

        return jsonify({
            'success': True,
            'plan': doc.get('plan'),
            'start_date': doc.get('start_date'),
            'statuses': doc.get('statuses', {}),
            'change_requests': cr_safe
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# Collaboration Routes

