from functools import wraps
from utils.api_response import send_error


def try_catch(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return send_error(str(e), None, 500)

    return wrapper