import pandas as pd
import re
import os

def clean_and_split_name(full_name):
    if not isinstance(full_name, str):
        return full_name, "."

    # 1. Remove prefixes
    prefixes = [
        "คุณ", "นาย", "นางสาว", "นาง", "น.ส.", "ด.ต.", "ร.ท.", "เจ๊ะ", "F.", "คุุณ", "ร้าน", "fคุณ", "คุณพี่"
    ]
    cleaned_name = full_name.strip()
    for prefix in prefixes:
        if cleaned_name.startswith(prefix):
            cleaned_name = cleaned_name[len(prefix):].strip()
            break

    # 2. Remove notes in brackets and info after **
    cleaned_name = re.sub(r'\(.*?\)', '', cleaned_name)
    cleaned_name = re.sub(r'\*\*.*', '', cleaned_name)
    cleaned_name = cleaned_name.strip()

    # 3. Split by first space
    parts = cleaned_name.split(' ', 1)
    first_name = parts[0].strip()
    last_name = parts[1].strip() if len(parts) > 1 else "."

    # Final cleanup of common trailing symbols
    first_name = first_name.rstrip('.')
    last_name = last_name.rstrip('.')
    
    if not first_name:
        first_name = "."
    if not last_name:
        last_name = "."

    return first_name, last_name

def main():
    file_path = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_ready.csv'
    output_path = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_ready_updated.csv'
    
    print(f"Reading {file_path}...")
    # Use 'utf-8-sig' to handle BOM properly if present, or fallback to 'utf-8' or 'tis-620'
    try:
        df = pd.read_csv(file_path, encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(file_path, encoding='tis-620')

    print("Splitting names...")
    new_names = df['first_name'].apply(clean_and_split_name)
    df['first_name'] = [n[0] for n in new_names]
    df['last_name'] = [n[1] for n in new_names]

    print(f"Writing to {output_path}...")
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print("Done!")

if __name__ == "__main__":
    main()
