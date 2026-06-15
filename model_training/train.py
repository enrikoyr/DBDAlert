import pandas as pd
import json
import os
from sklearn.naive_bayes import CategoricalNB
from sklearn.preprocessing import KBinsDiscretizer

# This script trains a Naive Bayes model using 3 years of DBD case data (2021-2023).
# It exports the trained model weights to a JSON file that Cloudflare Pages can use for inference.

DATA_FILE = "../data/historical_2021_2023.xlsx"
OUTPUT_FILE = "../data/model_weights.json"

def main():
    if not os.path.exists(DATA_FILE):
        print(f"Error: Could not find data file at {DATA_FILE}")
        print("Please place your 2021-2023 .xlsx historical data there.")
        return

    print("Loading data...")
    # Load the excel file
    df = pd.read_excel(DATA_FILE)

    # Note: The expected structure of the DataFrame is:
    # - district_name
    # - date (or week)
    # - dbd_cases
    # - population
    # - avg_temperature
    # - total_rainfall
    # - news_mentions
    #
    # Because we don't know the exact columns of your XLSX yet, this is a scaffold.
    # We will need to map your columns to features and discretize them.
    
    print("Pre-processing data...")
    # Placeholder for preprocessing logic:
    # 1. Define target variable: High/Medium/Low based on cases/population ratio.
    # 2. Discretize continuous features (temperature, rainfall) into High/Medium/Low.
    
    print("Training Naive Bayes Model...")
    # model = CategoricalNB()
    # model.fit(X, y)
    
    print("Exporting model weights...")
    # We will extract model.class_log_prior_ and model.feature_log_prob_
    # and save them to model_weights.json for edge inference.
    
    dummy_weights = {
        "classes": ["Low", "Medium", "High"],
        "class_prior": [0.6, 0.3, 0.1],
        "features": {
            "rainfall": {
                "Low": {"Low": 0.5, "Medium": 0.2, "High": 0.1},
                "High": {"Low": 0.1, "Medium": 0.3, "High": 0.8}
            }
        }
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(dummy_weights, f, indent=2)
        
    print(f"Model exported successfully to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
