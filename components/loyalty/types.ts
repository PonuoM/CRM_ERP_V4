export interface LoyaltySettings {
  spend_per_point: number;
  points_for_coupon: number;
  coupon_prefix: string;
  coupon_discount: number;
  coupon_min_spend: number;
  coupon_expiry_days: number;
  baseline_aov: number;
  target_aov: number;
  baseline_repeat_rate: number;
  target_repeat_rate: number;
  target_members: number;
  target_10_points: number;
  target_sales_percent: number;
  points_calculation_mode: 'capped' | 'proportional';
}

export interface DashboardStats {
  aov: number;
  repeat_rate: number;
  members_with_points: number;
  members_10_points: number;
  member_sales: number;
  total_members: number;
  member_sales_percent: number;
  company_sales: number;
}

export interface LoyaltyMember {
  shopee_username: string;
  total_points: number;
  created_at: string;
  coupons_count: number;
  latest_coupon: string | null;
  total_spent: number;
}

export interface LoyaltyOrder {
  order_id: string;
  order_date: string;
  total_amount: number | string;
  points_earned: number;
  items_summary?: string;
}

export interface LoyaltyCoupon {
  id: number;
  code: string;
  discount_value: number | string;
  min_spend: number | string;
  status: 'active' | 'used';
  expiry_date: string;
  created_at: string;
  used_at: string | null;
}
