import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib




df = pd.read_csv("dataset.csv")

# Add this helper near the top of train_model.py
def normalize_token(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = s.strip().lower()
    s = s.replace(" ", "_")
    s = s.replace("__", "_")
    # fix known typos from your CSV
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    s = s.replace("dischromic__patches", "dischromic_patches")
    # specific glitch in your CSV: "dischromic _patches"
    s = s.replace("dischromic__patches", "dischromic_patches").replace("dischromic__patches", "dischromic_patches")
    return s

# When you read the CSV into df, normalize every Symptom_* cell:
sym_cols = [c for c in df.columns if c.lower().startswith("symptom_")]
for c in sym_cols:
    df[c] = df[c].apply(normalize_token)


symptom_cols = [f"Symptom_{i}" for i in range(1, 18)]
all_symptoms = set()

for col in symptom_cols:
    all_symptoms.update(df[col].dropna().str.strip())

all_symptoms = sorted(list(all_symptoms))  


feature_df = pd.DataFrame(0, index=df.index, columns=all_symptoms)

for col in symptom_cols:
    for idx, val in df[col].items():
        if pd.notna(val):
            feature_df.at[idx, val.strip()] = 1


y = df["Disease"]


X_train, X_test, y_train, y_test = train_test_split(feature_df, y, test_size=0.2, random_state=42)


clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)


print("Accuracy:", clf.score(X_test, y_test))


joblib.dump(clf, "disease_model.pkl")
joblib.dump(all_symptoms, "symptom_features.pkl")

print("Model and features saved successfully!")


