import sys

def patch_file(filepath, old, new):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old not in content:
        print(f"Error: Could not find '{old}' in {filepath}")
        return
        
    content = content.replace(old, new)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully patched {filepath}")

# 1. Patch export_distribution.php
old_export = """    LEFT JOIN basket_config bc_from ON log.from_basket_key = bc_from.basket_key AND bc_from.company_id = 1
    LEFT JOIN basket_config bc_to ON log.to_basket_key = bc_to.basket_key AND bc_to.company_id = 1"""

new_export = """    LEFT JOIN basket_config bc_from ON log.from_basket_key = bc_from.id
    LEFT JOIN basket_config bc_to ON log.to_basket_key = bc_to.id"""

patch_file(r'c:\laragon\www\CRM_ERP_V4\api\Distribution\export_distribution.php', old_export, new_export)

# 2. Patch index.php (batch export)
old_index = """        LEFT JOIN basket_config bc ON dsd.previous_basket_key = bc.basket_key AND bc.company_id = 1"""

new_index = """        LEFT JOIN basket_config bc ON dsd.previous_basket_key = bc.id"""

patch_file(r'c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php', old_index, new_index)
