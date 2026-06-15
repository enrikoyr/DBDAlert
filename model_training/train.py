import pandas as pd
import numpy as np
import json
import os
from sklearn.naive_bayes import CategoricalNB
from sklearn.preprocessing import KBinsDiscretizer

DATA_FILE = "../data/KALIMANTAN BARAT DBD HISTORIS.xlsx"
OUTPUT_FILE = "../data/model_weights.json"

def synthesize_weekly_data(annual_df):
    """
    Since the dataset provides annual totals (e.g., 612 cases in 2023), 
    we need to synthesize weekly data to train a weekly predictor.
    Dengue is highly seasonal (peaks in rainy season: Oct-April).
    We distribute the annual cases across 52 weeks using a normal distribution curve centered on January (Week 4/5).
    """
    weekly_records = []
    
    # Simple probability distribution for 52 weeks (Peak in week 4, trough in week 30)
    weeks = np.arange(1, 53)
    # create a bimodal or shifted curve peaking around Jan/Feb and Nov/Dec
    prob = np.cos((weeks - 4) * 2 * np.pi / 52) + 1.2 
    prob = prob / prob.sum() # normalize to sum to 1
    
    for _, row in annual_df.iterrows():
        district = str(row['KABUPATEN/KOTA']).strip()
        for year, col in [(2021, '2021 (Orang)'), (2022, '2022 (Orang)'), (2023, '2023 (Orang)')]:
            if pd.isna(row[col]):
                continue
            total_cases = int(row[col])
            
            # Distribute cases across 52 weeks
            weekly_cases = np.random.multinomial(total_cases, prob)
            
            for w in range(52):
                week = w + 1
                cases = weekly_cases[w]
                
                # Synthesize weather & news correlations to train the model
                # If cases are high, probability of high rainfall and high news is higher
                is_high_risk = cases > (total_cases / 52) * 1.5
                
                rainfall = np.random.choice(['High', 'Medium', 'Low'], p=[0.7, 0.2, 0.1] if is_high_risk else [0.2, 0.3, 0.5])
                news_mentions = np.random.choice(['High', 'Medium', 'Low'], p=[0.8, 0.15, 0.05] if is_high_risk else [0.1, 0.2, 0.7])
                
                # Determine risk label
                if cases > 15:
                    risk = 'High'
                elif cases > 5:
                    risk = 'Medium'
                else:
                    risk = 'Low'
                
                weekly_records.append({
                    'district': district,
                    'year': year,
                    'week': week,
                    'cases': cases,
                    'rainfall': rainfall,
                    'news_mentions': news_mentions,
                    'risk': risk
                })
                
    return pd.DataFrame(weekly_records)

def main():
    if not os.path.exists(DATA_FILE):
        print(f"Error: Could not find {DATA_FILE}")
        return

    print("Loading data...")
    # Read the 'Dataset' sheet
    df = pd.read_excel(DATA_FILE, sheet_name='Dataset')
    
    print("Synthesizing weekly training data from annual totals...")
    weekly_df = synthesize_weekly_data(df)
    
    print(f"Generated {len(weekly_df)} weekly records for training.")
    
    # Map categorical features to integers for scikit-learn
    cat_map = {'Low': 0, 'Medium': 1, 'High': 2}
    risk_map = {'Low': 0, 'Medium': 1, 'High': 2}
    
    X = pd.DataFrame({
        'rainfall': weekly_df['rainfall'].map(cat_map),
        'news_mentions': weekly_df['news_mentions'].map(cat_map)
    })
    y = weekly_df['risk'].map(risk_map)
    
    print("Training Naive Bayes Model...")
    model = CategoricalNB()
    model.fit(X, y)
    
    print("Exporting model weights for Edge Inference...")
    # Extract prior probabilities P(Class)
    class_log_prior = model.class_log_prior_
    class_prior = np.exp(class_log_prior).tolist()
    
    # Extract feature probabilities P(Feature | Class)
    feature_probs = {}
    feature_names = ['rainfall', 'news_mentions']
    cat_inverse = {0: 'Low', 1: 'Medium', 2: 'High'}
    risk_inverse = {0: 'Low', 1: 'Medium', 2: 'High'}
    
    for i, feature in enumerate(feature_names):
        feature_probs[feature] = {}
        log_prob = model.feature_log_prob_[i]
        prob = np.exp(log_prob)
        
        # Log_prob shape is (n_classes, n_categories)
        for class_idx in range(len(model.classes_)):
            risk_label = risk_inverse[model.classes_[class_idx]]
            feature_probs[feature][risk_label] = {}
            
            for cat_idx in range(prob.shape[1]):
                cat_label = cat_inverse[cat_idx]
                feature_probs[feature][risk_label][cat_label] = prob[class_idx][cat_idx]

    weights = {
        "classes": ["Low", "Medium", "High"],
        "class_prior": dict(zip(["Low", "Medium", "High"], class_prior)),
        "features": feature_probs
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(weights, f, indent=2)
        
    print(f"Model successfully exported to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
