import { apiFetch } from './api';

export async function saveProductWithLots(payload: any) {
    const action = payload.id ? 'update' : 'create';
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    const headers: any = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("api/Product_DB/manage_product.php", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...payload, action })
    });
    return await res.json();
}

export async function deleteProductWithLots(id: number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    const headers: any = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("api/Product_DB/manage_product.php", {
        method: "POST",
        headers,
        body: JSON.stringify({ id, action: 'delete' })
    });
    return await res.json();
}
