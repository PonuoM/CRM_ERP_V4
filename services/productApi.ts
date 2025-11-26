import { apiFetch } from './api';

export async function saveProductWithLots(payload: any) {
    const action = payload.id ? 'update' : 'create';
    // We use direct fetch here because apiFetch might be configured for a specific base path structure
    // that doesn't match our new PHP file location exactly, or we just want to be explicit.
    // However, looking at api.ts, apiFetch uses a base path. 
    // The previous implementation used fetch directly to "api/Product_DB/manage_product.php".
    // Let's stick to that to ensure it works as verified.

    const res = await fetch("api/Product_DB/manage_product.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, action })
    });
    return await res.json();
}

export async function deleteProductWithLots(id: number) {
    const res = await fetch("api/Product_DB/manage_product.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: 'delete' })
    });
    return await res.json();
}
