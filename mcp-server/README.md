# Machitori MCP Server

MCP server exposing Machitori F&B management data — crew, attendance, orders, sales, stock, payroll, recruitment, and scheduling.

## Setup

```bash
cd mcp-server
npm install
bash create-env.sh    # generates .env with API key
npm run build
```

## Run

**SSE transport** (for Envoy / remote connections):
```bash
node dist/index.js --sse
# Listening on http://localhost:3100
```

**stdio transport** (for local Claude Code):
```bash
node dist/index.js --stdio
```

## Connect from Envoy

Register as an MCP server in Envoy with:
- **Transport**: SSE
- **URL**: `http://localhost:3100/sse` (or your server's address)
- **Headers**: `Authorization: Bearer <your-MCP_API_KEY>`

## Tools (40+)

### Crew / Employees
- `list_employees` — List crew with filters (active, department, search)
- `get_employee` — Full employee details
- `create_employee` — Add new crew member
- `update_employee` — Update crew details
- `list_departments` — All departments
- `list_job_positions` — All job positions
- `list_shifts` — All work shifts

### Attendance
- `list_attendance` — Attendance records with date/employee filters
- `clock_in` — Record clock-in
- `clock_out` — Record clock-out
- `get_attendance_summary` — Per-employee attendance stats for a period
- `get_attendance_settings` — Current attendance config
- `list_overtime_requests` — Overtime requests with status filter

### Orders & Sales
- `list_orders` — Orders with date/status filters
- `get_order` — Full order with items
- `get_sales_summary` — Revenue, order count, avg value for a period
- `list_sales_entries` — Manual sales entries
- `list_payment_methods` — Configured payment methods
- `list_customers` — Customer records

### Menu & Stock
- `list_menu_items` — Items with type/category/sellable filters
- `get_item` — Full item details
- `update_item` — Update item (price, name, category)
- `list_categories` — Item categories
- `get_stock_levels` — Current stock with low-stock filter
- `list_recipes` — Bill of materials / recipes
- `list_suppliers` — Supplier list
- `list_purchases` — Purchase/receiving records

### Payroll
- `list_payroll_runs` — Payroll runs by status/period
- `get_payroll_run` — Run with all payslips
- `get_payslip` — Single payslip with breakdown
- `get_payroll_settings` — Cutoff dates, payday config
- `list_allowances` — Payroll components (earnings/deductions)

### Recruitment
- `list_candidates` — Candidates with stage/position filter
- `get_candidate` — Full candidate with comments and events
- `update_candidate_stage` — Move candidate in pipeline
- `add_candidate_comment` — Add note to candidate

### Schedule
- `list_schedules` — Crew schedules for a date range
- `set_schedule` — Set/update a crew member's schedule
- `list_roster_patterns` — Recurring schedule templates
- `list_tables` — Restaurant tables
