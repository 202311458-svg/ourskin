import tensorflow as tf
import os

MODEL_PATH = "app/models/skin_model.h5"

if os.path.exists(MODEL_PATH):
    model = tf.keras.models.load_model(MODEL_PATH)
else:
    model = None