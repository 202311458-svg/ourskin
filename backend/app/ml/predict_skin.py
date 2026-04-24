import json
import os
import numpy as np
import tensorflow as tf
from PIL import Image
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

from app.ml.treatment_rules import TREATMENT_RULES

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "skin_model_finetuned.keras")
CLASS_MAP_PATH = os.path.join(BASE_DIR, "class_indices.json")

IMG_SIZE = 224

# Load model once
model = tf.keras.models.load_model(MODEL_PATH)

# Load class mapping
with open(CLASS_MAP_PATH, "r") as f:
    class_indices = json.load(f)

# Reverse mapping: 0 -> Acne, etc.
index_to_class = {v: k for k, v in class_indices.items()}


def predict_skin_condition(image_path: str):
    image = Image.open(image_path).convert("RGB")
    image = image.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(image, dtype=np.float32)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array)

    predictions = model.predict(img_array, verbose=0)[0]
    predicted_index = int(np.argmax(predictions))
    confidence = float(predictions[predicted_index])
    predicted_class = index_to_class[predicted_index]

    all_scores = {
        index_to_class[i]: float(predictions[i])
        for i in range(len(predictions))
    }

    rules = TREATMENT_RULES.get(predicted_class, {})

    return {
        "predicted_condition": predicted_class,
        "confidence": confidence,
        "all_scores": all_scores,
        "treatment_suggestions": rules.get("treatment_suggestions", []),
        "follow_up_suggestions": rules.get("follow_up", ""),
        "red_flags": rules.get("red_flags", [])
    }