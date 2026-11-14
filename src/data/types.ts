import type { Unit } from '../domain/math'
import type { Product, Observation, DiscountRule } from '../domain/prices'
export interface Household {
  id: string
  name: string
  default_diners: number
  timezone: string
}
export interface Category {
  id: string
  name: string
  sort_order: number
}
export interface Generic {
  archived_at?: string | null
  id: string
  name: string
  category_id: string | null
  canonical_unit: Unit
}
export interface Specific extends Product {
  archived_at?: string | null
  brand: string
  variant: string
  barcode: string | null
}
export interface Store {
  id: string
  name: string
  chain: string
  address: string
  city: string
  archived_at: string | null
}
export interface List {
  id: string
  title: string
  status: 'active' | 'completed' | 'archived'
  version: number
  created_at: string
}
export interface Item {
  archived_at?: string | null
  id: string
  list_id: string
  name: string
  generic_product_id: string | null
  specific_product_id: string | null
  unit: Unit
  note: string
  created_at: string
}
export interface Contribution {
  id: string
  item_id: string
  origin_type: 'manual' | 'recipe' | 'plan'
  origin_id: string
  requested_quantity: string
}
export interface Purchase {
  id: string
  list_item_id: string
  specific_product_id: string | null
  store_id: string | null
  quantity: string
  unit: Unit
  total_paid: string | null
  gross_paid: string | null
  discount_paid: string | null
  promotional: boolean | null
  purchased_at: string
  voided_at: string | null
}
export interface Recipe {
  archived_at?: string | null
  id: string
  title: string
  base_servings: number
  instructions: string
  notes: string
  is_favorite: boolean
  source_url: string | null
}
export interface Ingredient {
  id: string
  recipe_id: string
  generic_product_id: string
  quantity: string
  unit: Unit
}
export interface Plan {
  archived_at?: string | null
  id: string
  week_start: string
  linked_list_id: string | null
  version: number
}
export interface Meal {
  id: string
  meal_plan_id: string
  meal_date: string
  meal_slot: string
  recipe_id: string | null
  generic_product_id: string | null
  quantity: string | null
  unit: Unit | null
  servings_override: number | null
}
export interface Template {
  id: string
  name: string
  entries_json: Omit<Meal, 'id' | 'meal_plan_id'>[]
}
export interface Snapshot {
  archived_at?: string | null
  id: string
  list_id: string
  store_id: string
  estimated_total: string
  coverage: number
  created_at: string
  shopping_date: string
  detail_json: unknown
}
export interface Invite {
  id: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}
export interface Data {
  categories: Category[]
  generic_products: Generic[]
  specific_products: Specific[]
  stores: Store[]
  shopping_lists: List[]
  shopping_list_items: Item[]
  list_item_contributions: Contribution[]
  purchases: Purchase[]
  price_observations: Observation[]
  store_discount_rules: DiscountRule[]
  recipes: Recipe[]
  recipe_ingredients: Ingredient[]
  meal_plans: Plan[]
  meal_entries: Meal[]
  meal_templates: Template[]
  price_estimate_snapshots: Snapshot[]
  household_invites: Invite[]
}
export const emptyData: Data = {
  categories: [],
  generic_products: [],
  specific_products: [],
  stores: [],
  shopping_lists: [],
  shopping_list_items: [],
  list_item_contributions: [],
  purchases: [],
  price_observations: [],
  store_discount_rules: [],
  recipes: [],
  recipe_ingredients: [],
  meal_plans: [],
  meal_entries: [],
  meal_templates: [],
  price_estimate_snapshots: [],
  household_invites: [],
}
