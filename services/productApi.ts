import { apiFetch } from './api';

export async function saveProductWithLots(payload: any) {
    const action = payload.id ? 'update' : 'create';
    return apiFetch("Product_DB/manage_product.php", {
        method: "POST",
        body: JSON.stringify({ ...payload, action })
    });
}

export async function deleteProductWithLots(id: number) {
    return apiFetch("Product_DB/manage_product.php", {
        method: "POST",
        body: JSON.stringify({ id, action: 'delete' })
    });
}
