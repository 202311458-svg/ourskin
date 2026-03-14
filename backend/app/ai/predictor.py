import json
import numpy as np
from app.ai.preprocess import preprocess_image
from app.ai.model_loader import model

with open("app/ai/class_mapping.json") as f:
    class_mapping = json.load(f)

classes = [
    "acne",
    "eczema",
    "psoriasis",
    "vitiligo",
    "warts"
]


def determine_severity(confidence):

    if confidence < 0.60:
        return "Mild"

    elif confidence < 0.85:
        return "Moderate"

    else:
        return "Severe"


def get_recommendation(condition):

    recommendations = {
        "acne": "Maintain a gentle cleansing routine and consult a dermatologist if acne persists.",
        "eczema": "Avoid irritants and keep skin moisturized.",
        "psoriasis": "Seek medical consultation for appropriate treatment.",
        "vitiligo": "Consult a dermatologist for proper evaluation and treatment options.",
        "warts": "Avoid touching the affected area and consult a dermatologist if warts persist."
    }

    return recommendations.get(condition, "Consult a dermatologist for proper evaluation.")


def analyze_skin(image_path):

    img = preprocess_image(image_path)

    prediction = model.predict(img, verbose=0)
    
    index = np.argmax(prediction)

    condition = classes[index]

    confidence = float(prediction[0][index])

    severity = determine_severity(confidence)

    recommendation = get_recommendation(condition)

    return {
        "condition": condition,
        "severity": severity,
        "confidence": round(confidence, 2),
        "recommendation": recommendation,
        "note": "This AI analysis is for informational purposes only and does not replace professional medical diagnosis."
    }