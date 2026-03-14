import tensorflow as tf
from tensorflow.keras import layers, models
import os

# ensure models folder exists
os.makedirs("backend/app/models", exist_ok=True)

model = models.Sequential([
    layers.Input(shape=(224,224,3)),
    layers.Conv2D(16,3,activation="relu"),
    layers.MaxPooling2D(),
    layers.Flatten(),
    layers.Dense(5, activation="softmax")
])

model.save("backend/app/models/skin_model.h5")

print("Dummy model created successfully.")