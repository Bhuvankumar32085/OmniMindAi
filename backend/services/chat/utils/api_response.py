from flask import jsonify


def send_success(message: str, data=None, status_code: int = 200):
    return (
        jsonify({
            "success": True,
            "message": message,
            "data": data,
        }),
        status_code,
    )


def send_error(message: str, data=None, status_code: int = 500):
    return (
        jsonify({
            "success": False,
            "message": message,
            "data": data,
        }),
        status_code,
    )