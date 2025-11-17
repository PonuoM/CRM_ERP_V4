import { CustomerGrade } from "@/types";

export const calculateCustomerGrade = (totalAmount: number | null | undefined): CustomerGrade => {
  const amount = typeof totalAmount === "number" && Number.isFinite(totalAmount)
    ? totalAmount
    : 0;

  if (amount >= 50000) {
    return CustomerGrade.A;
  }
  if (amount >= 10000) {
    return CustomerGrade.B;
  }
  if (amount >= 5000) {
    return CustomerGrade.C;
  }
  if (amount >= 2000) {
    return CustomerGrade.D;
  }
  return CustomerGrade.E;
};

