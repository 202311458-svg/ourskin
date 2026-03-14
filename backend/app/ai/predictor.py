import numpy as np
from app.ai.preprocess import preprocess_image
from app.ai.model_loader import model

classes = [
    "acne",
    "eczema",
    "psoriasis",
    "pigmentation",
    "normal_skin"
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
        "pigmentation": "Use sun protection and consider dermatology consultation.",
        "normal_skin": "Skin condition appears normal. Maintain your skincare routine."
    }

    return recommendations.get(condition, "Consult a dermatologist for proper evaluation.")


def analyze_skin(image_path):

    img = preprocess_image(image_path)

    prediction = model.predict(img)

    index = np.argmax(prediction)

    condition = classes[index]

    confidence = float(prediction[0][index])

    severity = determine_severity(confidence)

    recommendation = get_recommendation(condition)

    return {
        "condition": condition,
        "severity": severity,
        "confidence": round(confidence,2),
        "recommendation": recommendation,
        "note": "This AI analysis is for informational purposes only and does not replace professional medical diagnosis."
    }