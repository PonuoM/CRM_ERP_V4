import pandas as pd
import json

file_path = "C:/laragon/www/CRM_ERP_V4/AllLiteDetailOrder20260515122631514.xlsx"
try:
    df = pd.read_excel(file_path, nrows=5)
    print("Headers:")
    for col in df.columns:
        print(f"- {col}")
    
    print("\nFirst row sample:")
    print(df.iloc[0].to_dict())
except Exception as e:
    print(f"Error: {e}")
