-- Comprehensive fix: align write RLS with the app's granular permission model.
-- Additive & non-destructive: adds permission-aware permissive policies alongside
-- the existing admin-only ones (permissive policies OR together), so any role that
-- HAS the module's write permission can insert/update/delete — matching what the
-- app already authorizes. Admin access is unchanged. No data is touched.
-- Uses public.has_permission() (added in 20260816160000).

DROP POLICY IF EXISTS "perm write locations insert" ON public.locations;
CREATE POLICY "perm write locations insert" ON public.locations FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('locations:write'));
DROP POLICY IF EXISTS "perm write locations update" ON public.locations;
CREATE POLICY "perm write locations update" ON public.locations FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('locations:write')) WITH CHECK (public.is_admin() OR public.has_permission('locations:write'));
DROP POLICY IF EXISTS "perm write locations delete" ON public.locations;
CREATE POLICY "perm write locations delete" ON public.locations FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('locations:write'));

DROP POLICY IF EXISTS "perm write item_unit_conversions insert" ON public.item_unit_conversions;
CREATE POLICY "perm write item_unit_conversions insert" ON public.item_unit_conversions FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('ingredients:write'));
DROP POLICY IF EXISTS "perm write item_unit_conversions update" ON public.item_unit_conversions;
CREATE POLICY "perm write item_unit_conversions update" ON public.item_unit_conversions FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('ingredients:write')) WITH CHECK (public.is_admin() OR public.has_permission('ingredients:write'));
DROP POLICY IF EXISTS "perm write item_unit_conversions delete" ON public.item_unit_conversions;
CREATE POLICY "perm write item_unit_conversions delete" ON public.item_unit_conversions FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('ingredients:write'));

DROP POLICY IF EXISTS "perm write prep_orders insert" ON public.prep_orders;
CREATE POLICY "perm write prep_orders insert" ON public.prep_orders FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'));
DROP POLICY IF EXISTS "perm write prep_orders update" ON public.prep_orders;
CREATE POLICY "perm write prep_orders update" ON public.prep_orders FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete')) WITH CHECK (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'));
DROP POLICY IF EXISTS "perm write prep_orders delete" ON public.prep_orders;
CREATE POLICY "perm write prep_orders delete" ON public.prep_orders FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'));

DROP POLICY IF EXISTS "perm write prep_order_items insert" ON public.prep_order_items;
CREATE POLICY "perm write prep_order_items insert" ON public.prep_order_items FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'));
DROP POLICY IF EXISTS "perm write prep_order_items update" ON public.prep_order_items;
CREATE POLICY "perm write prep_order_items update" ON public.prep_order_items FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete')) WITH CHECK (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'));
DROP POLICY IF EXISTS "perm write prep_order_items delete" ON public.prep_order_items;
CREATE POLICY "perm write prep_order_items delete" ON public.prep_order_items FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'));

DROP POLICY IF EXISTS "perm write stock_adjustments insert" ON public.stock_adjustments;
CREATE POLICY "perm write stock_adjustments insert" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('stock_adjustments:write'));
DROP POLICY IF EXISTS "perm write stock_adjustments update" ON public.stock_adjustments;
CREATE POLICY "perm write stock_adjustments update" ON public.stock_adjustments FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('stock_adjustments:write')) WITH CHECK (public.is_admin() OR public.has_permission('stock_adjustments:write'));
DROP POLICY IF EXISTS "perm write stock_adjustments delete" ON public.stock_adjustments;
CREATE POLICY "perm write stock_adjustments delete" ON public.stock_adjustments FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('stock_adjustments:write'));

DROP POLICY IF EXISTS "perm write stock_counts insert" ON public.stock_counts;
CREATE POLICY "perm write stock_counts insert" ON public.stock_counts FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('stock_counts:write'));
DROP POLICY IF EXISTS "perm write stock_counts update" ON public.stock_counts;
CREATE POLICY "perm write stock_counts update" ON public.stock_counts FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('stock_counts:write')) WITH CHECK (public.is_admin() OR public.has_permission('stock_counts:write'));
DROP POLICY IF EXISTS "perm write stock_counts delete" ON public.stock_counts;
CREATE POLICY "perm write stock_counts delete" ON public.stock_counts FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('stock_counts:write'));

DROP POLICY IF EXISTS "perm write stock_count_items insert" ON public.stock_count_items;
CREATE POLICY "perm write stock_count_items insert" ON public.stock_count_items FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('stock_counts:write'));
DROP POLICY IF EXISTS "perm write stock_count_items update" ON public.stock_count_items;
CREATE POLICY "perm write stock_count_items update" ON public.stock_count_items FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('stock_counts:write')) WITH CHECK (public.is_admin() OR public.has_permission('stock_counts:write'));
DROP POLICY IF EXISTS "perm write stock_count_items delete" ON public.stock_count_items;
CREATE POLICY "perm write stock_count_items delete" ON public.stock_count_items FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('stock_counts:write'));

DROP POLICY IF EXISTS "perm write stock_ledger insert" ON public.stock_ledger;
CREATE POLICY "perm write stock_ledger insert" ON public.stock_ledger FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('prep_orders:complete') OR public.has_permission('sales:write') OR public.has_permission('purchasing:purchase') OR public.has_permission('stock_adjustments:write') OR public.has_permission('stock_counts:write'));

DROP POLICY IF EXISTS "perm write purchases insert" ON public.purchases;
CREATE POLICY "perm write purchases insert" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "perm write purchases update" ON public.purchases;
CREATE POLICY "perm write purchases update" ON public.purchases FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:purchase')) WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "perm write purchases delete" ON public.purchases;
CREATE POLICY "perm write purchases delete" ON public.purchases FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:purchase'));

DROP POLICY IF EXISTS "perm write purchase_items insert" ON public.purchase_items;
CREATE POLICY "perm write purchase_items insert" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "perm write purchase_items update" ON public.purchase_items;
CREATE POLICY "perm write purchase_items update" ON public.purchase_items FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:purchase')) WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "perm write purchase_items delete" ON public.purchase_items;
CREATE POLICY "perm write purchase_items delete" ON public.purchase_items FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:purchase'));

DROP POLICY IF EXISTS "perm write purchase_purchase_requests insert" ON public.purchase_purchase_requests;
CREATE POLICY "perm write purchase_purchase_requests insert" ON public.purchase_purchase_requests FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "perm write purchase_purchase_requests update" ON public.purchase_purchase_requests;
CREATE POLICY "perm write purchase_purchase_requests update" ON public.purchase_purchase_requests FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:purchase')) WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "perm write purchase_purchase_requests delete" ON public.purchase_purchase_requests;
CREATE POLICY "perm write purchase_purchase_requests delete" ON public.purchase_purchase_requests FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:purchase'));

DROP POLICY IF EXISTS "perm write purchase_requests update" ON public.purchase_requests;
CREATE POLICY "perm write purchase_requests update" ON public.purchase_requests FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('purchasing:request') OR public.has_permission('purchasing:approve')) WITH CHECK (public.is_admin() OR public.has_permission('purchasing:request') OR public.has_permission('purchasing:approve'));

DROP POLICY IF EXISTS "perm write units update" ON public.units;
CREATE POLICY "perm write units update" ON public.units FOR UPDATE TO authenticated USING ((public.is_admin() OR public.has_permission('units:write')) AND NOT is_system) WITH CHECK ((public.is_admin() OR public.has_permission('units:write')) AND NOT is_system);

DROP POLICY IF EXISTS "perm write employees insert" ON public.employees;
CREATE POLICY "perm write employees insert" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write employees update" ON public.employees;
CREATE POLICY "perm write employees update" ON public.employees FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write employees delete" ON public.employees;
CREATE POLICY "perm write employees delete" ON public.employees FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write departments insert" ON public.departments;
CREATE POLICY "perm write departments insert" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write departments update" ON public.departments;
CREATE POLICY "perm write departments update" ON public.departments FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write departments delete" ON public.departments;
CREATE POLICY "perm write departments delete" ON public.departments FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write job_positions insert" ON public.job_positions;
CREATE POLICY "perm write job_positions insert" ON public.job_positions FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write job_positions update" ON public.job_positions;
CREATE POLICY "perm write job_positions update" ON public.job_positions FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write job_positions delete" ON public.job_positions;
CREATE POLICY "perm write job_positions delete" ON public.job_positions FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write employment_statuses insert" ON public.employment_statuses;
CREATE POLICY "perm write employment_statuses insert" ON public.employment_statuses FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write employment_statuses update" ON public.employment_statuses;
CREATE POLICY "perm write employment_statuses update" ON public.employment_statuses FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write employment_statuses delete" ON public.employment_statuses;
CREATE POLICY "perm write employment_statuses delete" ON public.employment_statuses FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write job_levels insert" ON public.job_levels;
CREATE POLICY "perm write job_levels insert" ON public.job_levels FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write job_levels update" ON public.job_levels;
CREATE POLICY "perm write job_levels update" ON public.job_levels FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write job_levels delete" ON public.job_levels;
CREATE POLICY "perm write job_levels delete" ON public.job_levels FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write allowances insert" ON public.allowances;
CREATE POLICY "perm write allowances insert" ON public.allowances FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write allowances update" ON public.allowances;
CREATE POLICY "perm write allowances update" ON public.allowances FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write allowances delete" ON public.allowances;
CREATE POLICY "perm write allowances delete" ON public.allowances FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write payroll_component_versions insert" ON public.payroll_component_versions;
CREATE POLICY "perm write payroll_component_versions insert" ON public.payroll_component_versions FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_component_versions update" ON public.payroll_component_versions;
CREATE POLICY "perm write payroll_component_versions update" ON public.payroll_component_versions FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_component_versions delete" ON public.payroll_component_versions;
CREATE POLICY "perm write payroll_component_versions delete" ON public.payroll_component_versions FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write shifts insert" ON public.shifts;
CREATE POLICY "perm write shifts insert" ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write shifts update" ON public.shifts;
CREATE POLICY "perm write shifts update" ON public.shifts FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write shifts delete" ON public.shifts;
CREATE POLICY "perm write shifts delete" ON public.shifts FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write attendance insert" ON public.attendance;
CREATE POLICY "perm write attendance insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write attendance update" ON public.attendance;
CREATE POLICY "perm write attendance update" ON public.attendance FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write attendance delete" ON public.attendance;
CREATE POLICY "perm write attendance delete" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write attendance_settings insert" ON public.attendance_settings;
CREATE POLICY "perm write attendance_settings insert" ON public.attendance_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write attendance_settings update" ON public.attendance_settings;
CREATE POLICY "perm write attendance_settings update" ON public.attendance_settings FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write attendance_settings delete" ON public.attendance_settings;
CREATE POLICY "perm write attendance_settings delete" ON public.attendance_settings FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write overtime_compensations insert" ON public.overtime_compensations;
CREATE POLICY "perm write overtime_compensations insert" ON public.overtime_compensations FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write overtime_compensations update" ON public.overtime_compensations;
CREATE POLICY "perm write overtime_compensations update" ON public.overtime_compensations FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write overtime_compensations delete" ON public.overtime_compensations;
CREATE POLICY "perm write overtime_compensations delete" ON public.overtime_compensations FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write overtime_compensation_versions insert" ON public.overtime_compensation_versions;
CREATE POLICY "perm write overtime_compensation_versions insert" ON public.overtime_compensation_versions FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write overtime_compensation_versions update" ON public.overtime_compensation_versions;
CREATE POLICY "perm write overtime_compensation_versions update" ON public.overtime_compensation_versions FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write overtime_compensation_versions delete" ON public.overtime_compensation_versions;
CREATE POLICY "perm write overtime_compensation_versions delete" ON public.overtime_compensation_versions FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write overtime_requests insert" ON public.overtime_requests;
CREATE POLICY "perm write overtime_requests insert" ON public.overtime_requests FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write overtime_requests update" ON public.overtime_requests;
CREATE POLICY "perm write overtime_requests update" ON public.overtime_requests FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write overtime_requests delete" ON public.overtime_requests;
CREATE POLICY "perm write overtime_requests delete" ON public.overtime_requests FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write payroll_runs insert" ON public.payroll_runs;
CREATE POLICY "perm write payroll_runs insert" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_runs update" ON public.payroll_runs;
CREATE POLICY "perm write payroll_runs update" ON public.payroll_runs FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_runs delete" ON public.payroll_runs;
CREATE POLICY "perm write payroll_runs delete" ON public.payroll_runs FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write payslips insert" ON public.payslips;
CREATE POLICY "perm write payslips insert" ON public.payslips FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payslips update" ON public.payslips;
CREATE POLICY "perm write payslips update" ON public.payslips FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payslips delete" ON public.payslips;
CREATE POLICY "perm write payslips delete" ON public.payslips FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write payslip_lines insert" ON public.payslip_lines;
CREATE POLICY "perm write payslip_lines insert" ON public.payslip_lines FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payslip_lines update" ON public.payslip_lines;
CREATE POLICY "perm write payslip_lines update" ON public.payslip_lines FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payslip_lines delete" ON public.payslip_lines;
CREATE POLICY "perm write payslip_lines delete" ON public.payslip_lines FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write payroll_settings_versions insert" ON public.payroll_settings_versions;
CREATE POLICY "perm write payroll_settings_versions insert" ON public.payroll_settings_versions FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_settings_versions update" ON public.payroll_settings_versions;
CREATE POLICY "perm write payroll_settings_versions update" ON public.payroll_settings_versions FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_settings_versions delete" ON public.payroll_settings_versions;
CREATE POLICY "perm write payroll_settings_versions delete" ON public.payroll_settings_versions FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

DROP POLICY IF EXISTS "perm write payroll_settings insert" ON public.payroll_settings;
CREATE POLICY "perm write payroll_settings insert" ON public.payroll_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_settings update" ON public.payroll_settings;
CREATE POLICY "perm write payroll_settings update" ON public.payroll_settings FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
DROP POLICY IF EXISTS "perm write payroll_settings delete" ON public.payroll_settings;
CREATE POLICY "perm write payroll_settings delete" ON public.payroll_settings FOR DELETE TO authenticated USING (public.is_admin() OR public.has_permission('employees:write'));

