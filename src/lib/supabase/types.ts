export type UnitCode = string;
export type UserRole = string; // any role name — defined in the roles table
export type ItemType = 'ingredient' | 'supply' | 'product' | 'prep_item';
export type CategoryType = 'ingredient' | 'supply' | 'product';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_owner: boolean;
  must_change_password: boolean;
  access_backoffice: boolean;
  access_crew: boolean;
  created_at: string;
};

export type ProfileWithPermissions = Profile & { permissions: string[] };

export type Updater = Pick<Profile, "full_name" | "email">;

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type CategoryWithUpdater = Category & {
  updater: Updater | null;
};

export type Item = {
  id: string;
  name: string;
  brand: string | null;
  category_id: string | null;
  unit: UnitCode;
  type: ItemType;
  on_hand: number;
  reserved: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  last_purchase_cost: number | null;
  avg_purchase_cost: number | null;
  default_purchase_cost: number | null;
  default_purchase_cost_unit: UnitCode | null;
  purchase_unit: UnitCode | null;
  purchase_unit_qty: number | null;
  deleted_at: string | null;
  is_sellable: boolean;
  sell_price: number | null;
  is_addon: boolean;
  image_url: string | null;
  description: string | null;
  location_id: string | null;
  station: RecipeStation | null;
};

export type Location = {
  id: string;
  name: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierPic = {
  id: string;
  supplier_id: string;
  name: string;
  whatsapp: string | null;
  created_at: string;
};

export type SupplierWithPics = Supplier & {
  supplier_pics: SupplierPic[];
};

export type ItemWithCategory = Item & {
  categories: Pick<Category, "id" | "name"> | null;
  location?: Pick<Location, "id" | "name"> | null;
  updater: Updater | null;
};

export type RecipeStation = 'bar' | 'kitchen';

export type Recipe = {
  id: string;
  name: string;
  product_id: string | null;
  station: RecipeStation | null;
  yield_qty: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type RecipeItem = {
  id: string;
  recipe_id: string;
  item_id: string;
  quantity: number;
  unit: UnitCode;
  created_at: string;
};

export type RecipeItemWithItem = RecipeItem & {
  item: Pick<Item, "id" | "name" | "unit" | "deleted_at"> | null;
};

export type PurchaseRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type PurchaseRequest = {
  id: string;
  status: PurchaseRequestStatus;
  note: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  supplier_id: string | null;
};

export type PurchaseRequestItem = {
  id: string;
  request_id: string;
  item_id: string;
  qty: number;
  unit: string;
  created_at: string;
};

export type PurchaseRequestItemWithItem = PurchaseRequestItem & {
  item: Pick<Item, 'id' | 'name' | 'unit' | 'on_hand' | 'reserved'> | null;
};

export type PurchaseRequestWithItems = PurchaseRequest & {
  purchase_request_items: PurchaseRequestItemWithItem[];
  creator: Updater | null;
  reviewer: Updater | null;
  supplier: Pick<Supplier, 'id' | 'name'> | null;
};

export type Purchase = {
  id: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  supplier_id: string | null;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  item_id: string;
  qty_requested: number | null;
  requested_unit: string | null;
  qty_purchased: number;
  unit: string;
  cost_per_unit: number | null;
  cost_total: number | null;
  row_note: string | null;
  created_at: string;
};

export type PurchaseItemWithItem = PurchaseItem & {
  item: Pick<Item, 'id' | 'name' | 'unit'> | null;
};

export type PurchaseWithItems = Purchase & {
  purchase_items: PurchaseItemWithItem[];
  updater: Updater | null;
  purchase_request: Pick<PurchaseRequest, 'id'> | null;
  supplier: Pick<Supplier, 'id' | 'name'> | null;
};

export type RecipeWithItems = Recipe & {
  recipe_items: RecipeItemWithItem[];
  updater: Updater | null;
  product: Pick<Item, "id" | "name" | "unit"> | null;
};

// ─── Employees ────────────────────────────────────────────────────────────────

export type Department = {
  id: string;
  name: string;
  updated_by: string | null;
  updated_at: string;
};

export type JobPosition = {
  id: string;
  name: string;
  department_id: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type JobPositionWithDepartment = JobPosition & {
  departments: Pick<Department, 'id' | 'name'> | null;
};

export type EmploymentStatus = {
  id: string;
  name: string;
  updated_by: string | null;
  updated_at: string;
};

export type JobLevel = {
  id: string;
  name: string;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
};

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Gender = 'male' | 'female';

export type Employee = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  join_date: string | null;
  termination_date: string | null;
  last_day: string | null;
  active: boolean;
  nik: string | null;
  address: string | null;
  marital_status: MaritalStatus | null;
  gender: Gender | null;
  photo_url: string | null;
  department_id: string | null;
  job_position_id: string | null;
  job_level_id: string | null;
  employment_status_id: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  account_holder_name: string | null;
  basic_salary: number | null;
  salary_unit: 'day' | 'month' | null;
  daily_allowance: number | null;
  allowances: EmployeeAllowance[];
  user_id: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
};

export type EmployeeAllowance = { allowance_id: string; amount: number };

export type PayrollComponentType = 'earning' | 'deduction';
export type RateUnit = 'day' | 'week' | 'month';

export type PayrollComponentVersion = {
  id: string;
  component_id: string;
  effective_date: string;
  amount: number;
  rate_unit: RateUnit;
  created_by: string | null;
  created_at: string;
};

export type Allowance = {
  id: string;
  name: string;
  type: PayrollComponentType;
  is_default: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type EmployeeWithRelations = Employee & {
  departments: Pick<Department, 'id' | 'name'> | null;
  job_positions: Pick<JobPosition, 'id' | 'name'> | null;
  job_levels: Pick<JobLevel, 'id' | 'name'> | null;
  employment_statuses: Pick<EmploymentStatus, 'id' | 'name'> | null;
  mac_user: Pick<Profile, 'id' | 'email' | 'role' | 'is_owner'> | null;
  updater: Updater | null;
};

export type Shift = {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  updated_by: string | null;
  updated_at: string;
};

export type PayrollSettings = {
  id: string;
  cutoff_start_day: number;
  cutoff_end_day: number;
  payday: number;
  daily_allowance_by_attendance: boolean;
  deduct_absence_from_salary: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type PayrollSettingsVersion = {
  id: string;
  effective_date: string;
  cutoff_start_day: number;
  cutoff_end_day: number;
  payday: number;
  daily_allowance_by_attendance: boolean;
  deduct_absence_from_salary: boolean;
  created_by: string | null;
  created_at: string;
};

export type OvertimeCompensation = {
  id: string;
  name: string;
  job_level_id: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type OvertimeCompensationVersion = {
  id: string;
  compensation_id: string;
  effective_date: string;
  amount_per_hour: number;
  cap_hours: boolean;
  max_hours_per_day: number;
  created_by: string | null;
  created_at: string;
};

export type PayrollRunStatus = 'draft' | 'finalized';

export type PayrollRun = {
  id: string;
  anchor_year: number;
  anchor_month: number;
  period_start: string;
  period_end: string;
  payday: string;
  status: PayrollRunStatus;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PayslipLine = {
  id: string;
  payslip_id: string;
  kind: 'earning' | 'deduction';
  label: string;
  detail: string | null;
  amount: number;
  sort: number;
};

export type Payslip = {
  id: string;
  run_id: string;
  employee_id: string;
  working_days: number;
  present_days: number;
  absent_days: number;
  day_off_days: number;
  overtime_hours: number;
  earnings_total: number;
  deductions_total: number;
  thp: number;
  created_at: string;
};

export type OvertimeRequestStatus = 'pending' | 'approved' | 'rejected';

export type OvertimeRequest = {
  id: string;
  employee_id: string;
  work_date: string;
  hours: number;
  reason: string | null;
  status: OvertimeRequestStatus;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OvertimeRequestWithCrew = OvertimeRequest & {
  employees: Pick<Employee, 'id' | 'name'> | null;
};

export type ToleranceDirection = 'before' | 'after';

export type AttendanceSettings = {
  id: string;
  late_grace_minutes: number;
  late_tolerance_direction: ToleranceDirection;
  early_leave_grace_minutes: number;
  working_days_per_week: number;
  allowed_ips: string | null;
  store_lat: number | null;
  store_lng: number | null;
  geofence_radius_m: number | null;
  require_location: boolean;
  clock_in_earliest: string | null;
  clock_in_latest: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type AttendanceSource = 'web' | 'mobile';

/** One completed break within a work day (times are "HH:MM[:SS]"). */
export type BreakInterval = { start: string; end: string };

export type Attendance = {
  id: string;
  employee_id: string;
  shift_id: string | null;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  break_start: string | null;
  breaks: BreakInterval[];
  note: string | null;
  source: AttendanceSource;
  clock_in_ip: string | null;
  clock_out_ip: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type AttendanceWithRelations = Attendance & {
  employees: Pick<Employee, 'id' | 'name'> | null;
  shifts: Pick<Shift, 'id' | 'name' | 'start_time' | 'end_time'> | null;
  creator: Updater | null;
  updater: Updater | null;
};
