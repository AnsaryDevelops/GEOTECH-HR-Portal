The HR area is currently mostly placeholder/empty screens.

We now need to implement the complete V1 HR Administration layer and connect it to the existing Employee and Manager functionality.

IMPORTANT:
Do NOT redesign the existing application shell or create a separate HR visual language.

Use the existing:
- Design system
- Graphik typography
- Logo
- Colors
- Components
- Tables
- Forms
- Status badges
- Modals
- Notifications
- Application shell

Do NOT use placeholder messages such as:
"Coming soon"
"Available in the next release"
"This page is under development"

The HR screens are part of V1 and must be functional.

==================================================
1. HR V1 RESPONSIBILITIES
==================================================

HR is responsible for:

- Managing employees
- Creating employee accounts
- Editing employee information
- Assigning employee role
- Assigning department
- Assigning direct manager
- Activating/deactivating employee accounts
- Viewing all requests
- Filtering requests
- Viewing request details
- Managing Leave Types
- Viewing notifications

The employee hierarchy must be managed exclusively by HR.

==================================================
2. IMPORTANT ROLE MODEL
==================================================

There are three application roles:

EMPLOYEE
MANAGER
HR

When HR creates a user, HR must be able to select:

[ Employee ]
[ Manager ]
[ HR ]

However, keep the distinction clear:

A Manager is also an employee in the organizational hierarchy.

Therefore:

- A user with role MANAGER can have employees reporting to them.
- A user with role EMPLOYEE normally reports to a manager.
- A user with role HR manages the HR administration functionality.

Do not create a separate "manager entity" disconnected from employees.

The manager must be an employee record with the MANAGER role.

==================================================
3. HR DASHBOARD
==================================================

Build:

H01 — HR Dashboard

The dashboard should answer:

"What is happening across the organization?"

Show a clean summary:

- Total Employees
- Active Employees
- Total Requests
- Pending Requests
- Approved Requests
- Rejected Requests

Also show:

"Recent Requests"

with a concise list/table containing:

- Request Number
- Employee
- Request Type
- Date / Period
- Manager
- Status
- Submitted Date

Provide quick actions:

[ Add Employee ]

[ View All Requests ]

[ View Employees ]

Do not turn this into an analytics/BI dashboard.

Keep V1 simple.

All numbers and requests must come from the persistent data layer.

Do not hard-code dashboard numbers.

==================================================
4. HR EMPLOYEES
==================================================

Build:

H02 — Employees

This must be a real employee directory.

Show:

- Employee Name
- Employee ID
- Position
- Department
- Direct Manager
- Role
- Status
- Actions

Add:

Search:
"Search employees..."

Search by:
- Employee name
- Employee ID

Add useful filters:

Role:
[ All Roles ]
[ Employee ]
[ Manager ]
[ HR ]

Department:
[ All Departments ]

Status:
[ All ]
[ Active ]
[ Inactive ]

Primary action:

[ Add Employee ]

Clicking an employee opens the Employee Details/Edit experience.

==================================================
5. ADD EMPLOYEE
==================================================

Build:

H03 — Add Employee

This is one of the most important HR screens.

The form should include:

Employee ID *
[ EMP-00001 ]

First Name *
[ ]

Last Name *
[ ]

Email *
[ ]

Phone
[ ]

Position *
[ ]

Department *
[ Select Department ]

Role *
[ Employee / Manager / HR ]

Direct Manager
[ Select Manager ]

Account Status
[ Active / Inactive ]

==================================================
6. MANAGER SELECTION
==================================================

The Direct Manager field MUST be a real dropdown.

It must dynamically retrieve eligible active employees with role:

MANAGER

Example:

Direct Manager
[ Select manager ▼ ]

Options:

Jordan Lee
Sara Mohamed
Omar Hassan

Do NOT hard-code the managers.

Do NOT allow the HR user to type arbitrary manager names.

Do NOT allow selecting an inactive manager.

Do NOT allow an employee to be their own manager.

IMPORTANT ROLE LOGIC:

If Role = EMPLOYEE:

Direct Manager is required.

If Role = MANAGER:

Direct Manager may be optional unless the manager themselves reports to another manager.

If Role = HR:

Direct Manager should not be required.

However, the system should allow a future hierarchy where a manager can also report to another manager.

Keep the data model flexible enough for this.

==================================================
7. EMPLOYEE CREATION
==================================================

When HR submits Add Employee:

1. Validate all required fields.
2. Create the employee record.
3. Create the associated authentication/user record.
4. Assign the selected role.
5. Assign department.
6. Assign direct manager.
7. Set account status.
8. Generate/establish the employee's initial login access using the existing authentication approach.
9. Show success confirmation.

Example:

"Employee created successfully."

Show:

Employee ID
Employee Name
Role
Direct Manager
Account Status

Then provide:

[ View Employee ]

[ Back to Employees ]

Do not store permanent passwords in plaintext.

==================================================
8. EDIT EMPLOYEE
==================================================

HR must be able to edit:

- First Name
- Last Name
- Email
- Phone
- Position
- Department
- Role
- Direct Manager
- Account Status

When changing the Direct Manager:

The system must update the employee hierarchy.

This should immediately affect:

- Manager's My Team
- Request approval routing for future requests

IMPORTANT:

Do not change the approver of an already submitted request simply because the employee's manager later changes.

A request should retain the approver that was assigned when the request was created.

Future requests should use the employee's current direct manager.

==================================================
9. ROLE CHANGE
==================================================

HR can change an employee's role.

Example:

EMPLOYEE
→ MANAGER

When an employee becomes a Manager:

- They become eligible to be selected as a direct manager.
- Their Manager dashboard becomes available.
- My Team becomes available.
- They can receive requests from their direct reports.

If a MANAGER becomes EMPLOYEE:

- They should no longer have Manager functionality.
- Their existing direct reports must be handled safely.

Do NOT automatically destroy hierarchy relationships.

If role changes create a hierarchy conflict, clearly surface the issue to HR instead of silently breaking relationships.

==================================================
10. ACCOUNT STATUS
==================================================

HR can:

Active
Inactive

When an employee is inactive:

- They cannot log in.
- They cannot submit requests.
- They should not appear as an eligible manager.
- Their historical requests remain available.
- Their historical data must not be deleted.

Do not delete employee records simply to deactivate an account.

==================================================
11. EMPLOYEE DETAILS
==================================================

Create a reusable Employee Details view.

Show:

Employee Information
- Employee ID
- Name
- Email
- Phone
- Position
- Department
- Role
- Status

Organization
- Direct Manager
- Direct Reports count

Account
- Account status
- Last login if available

HR actions:

[ Edit Employee ]

[ Activate / Deactivate ]

Do not expose passwords.

==================================================
12. HR REQUESTS
==================================================

Build:

H04 — All Requests

HR must see requests across the entire organization.

Use a real table.

Columns:

Request Number
Employee
Request Type
Leave Type if applicable
Period
Manager
Status
Submitted Date

Clicking a row opens Request Details.

==================================================
13. HR REQUEST FILTERS
==================================================

HR must be able to filter by:

Manager
Employee
Request Type
Status
From Date
To Date

Example:

Manager
[ All Managers ▼ ]

Employee
[ Search Employee ]

Request Type
[ All ▼ ]

Status
[ All ▼ ]

From
[ Date ]

To
[ Date ]

[ Apply Filters ]

[ Clear Filters ]

Filters can be combined.

All filter options must come from real data.

Manager filter should contain active/inactive managers as appropriate for historical request visibility.

Employee filter should contain employees.

==================================================
14. HR REQUEST DETAILS
==================================================

Build:

H05 — Request Details

HR can view:

Request Number
Status
Employee
Employee ID
Department
Direct Manager
Request Type
Leave Type if applicable
Start Date
Start Time if applicable
End Date
End Time if applicable
Location if applicable
Reason / Purpose
Manager comments
Request timeline
Created date
Last updated date

HR should be able to see the complete request history.

By default HR does NOT get Approve/Reject buttons.

Approval remains the responsibility of the assigned manager.

==================================================
15. HR NOTIFICATIONS
==================================================

Build:

H06 — Notifications

Use the existing notification system.

HR notifications may include relevant administrative events such as:

- Employee account changes
- Important request activity if applicable

Do not create excessive notifications in V1.

Use the existing notification component and read/unread behavior.

==================================================
16. HR SETTINGS
==================================================

Build the Settings screen.

For V1, Settings should contain:

"Leave Types"

HR can:

- View Leave Types
- Add Leave Type
- Edit Leave Type
- Activate Leave Type
- Deactivate Leave Type

Example:

Annual Leave     Active
Sick Leave       Active
Emergency Leave Active

Do NOT permanently delete Leave Types if they are referenced by historical requests.

Prefer:

Active → Inactive

==================================================
17. ADD LEAVE TYPE
==================================================

HR should be able to add a Leave Type.

Fields:

Name *
[ Leave Type Name ]

Status
[ Active ]

Action:

[ Save ]

After creation, it should immediately become available in the Employee Leave Request dropdown if Active.

==================================================
18. EDIT LEAVE TYPE
==================================================

HR can edit the Leave Type name and status.

If a Leave Type is inactive:

- It should not appear in new Employee Leave forms.
- Existing requests using that Leave Type must continue displaying it correctly.

==================================================
19. CRITICAL DATA RELATIONSHIP
==================================================

The following relationship must be the source of truth:

Employee
↓
manager_id
↓
Manager Employee

Example:

Ahmed
manager_id → Jordan

This same relationship MUST drive:

1. Employee's displayed Direct Manager
2. Employee's Leave/Mission approver
3. Manager's My Team
4. Manager's pending requests

Do NOT implement separate hard-coded logic for these.

==================================================
20. REQUEST APPROVER
==================================================

When an employee creates a new request:

The application must automatically determine:

employee.manager_id

and create:

request.approver_id = employee.manager_id

The employee cannot choose the approver.

The manager must not be manually assigned to each request.

==================================================
21. IMPORTANT HISTORICAL DATA RULE
==================================================

When a request is created, store the approver associated with that request.

Example:

Ahmed
Current manager = Jordan

Ahmed submits request.

Request:
approver_id = Jordan

Later HR changes Ahmed's manager to Sara.

The old request must remain assigned to Jordan.

A NEW request created after the change should be assigned to Sara.

This prevents historical requests from changing unexpectedly.

==================================================
22. HR SECURITY
==================================================

Only HR can:

- Create employees
- Edit employees
- Change roles
- Change managers
- Activate/deactivate accounts
- Manage Leave Types

Employees and Managers must not access HR administration endpoints.

Do not rely only on hiding navigation items.

Enforce permissions at the server/backend level.

==================================================
23. DATA INTEGRITY
==================================================

Do not create fake UI-only employees.

Do not create fake UI-only managers.

Do not hard-code team members.

Do not hard-code manager dropdown options.

Do not hard-code request counts.

Do not hard-code HR dashboard metrics.

Everything should come from the application's persistent data layer.

==================================================
24. TEST DATA
==================================================

Use the existing development users where possible.

Ensure there are enough development records to test the hierarchy.

At minimum create/maintain:

Manager:
Jordan Lee

Employee reporting to Jordan:
At least one employee.

Another manager:
At least one additional Manager.

Employee reporting to the second manager:
At least one employee.

This is necessary to prove that manager visibility is correctly isolated.

==================================================
25. END-TO-END TEST
==================================================

After implementing HR functionality, test this exact scenario:

HR logs in
↓
HR opens Employees
↓
HR creates Employee A
↓
Role = Employee
↓
Department = IT
↓
Direct Manager = Jordan Lee
↓
Employee is Active
↓
Employee account is created
↓
Employee A logs in
↓
Employee sees Jordan Lee as Direct Manager
↓
Employee submits Leave request
↓
Request approver automatically becomes Jordan Lee
↓
Jordan logs in
↓
Jordan opens My Team
↓
Employee A appears
↓
Jordan opens Requests
↓
Employee A's request appears
↓
Jordan approves/rejects
↓
Employee A receives notification
↓
Employee A sees updated request status

Then test:

HR changes Employee A's manager from Jordan Lee to another Manager.

Verify:

- Employee A now sees the new manager.
- Future requests go to the new manager.
- Existing requests retain their original approver.
- Employee A appears under the new manager's My Team.
- Employee A no longer appears under Jordan's My Team.

==================================================
26. RESPONSIVE UI
==================================================

Use the existing responsive system.

Primary:
1440 × 900

Validate:
1920 × 920
1280 × 800
1024 × 768
390 × 844

HR tables should remain usable at smaller widths.

On mobile, tables may transform into cards/list views where appropriate.

Do not introduce horizontal scrolling unnecessarily.

==================================================
27. IMPORTANT — DO NOT STOP AT UI
==================================================

These HR screens must be functional.

Do NOT implement:

"Coming soon"

"Available in the next release"

"Placeholder"

or static fake tables.

Implement the actual data relationships and persistence.

If any backend capability is currently unavailable in the project, identify exactly what is missing rather than simulating the functionality.

==================================================
28. DO NOT CHANGE
==================================================

Do not change:

- Login design
- Authentication design
- Existing Employee Dashboard
- Existing Manager Dashboard
- Existing application shell
- Existing design system
- Graphik typography
- Existing navigation structure unless necessary to expose completed HR features

Reuse existing components.

==================================================
29. FINAL REPORT
==================================================

After implementation, report:

1. Which HR screens were completed.
2. Which components were reused.
3. How employee creation works.
4. How role assignment works.
5. How manager assignment works.
6. How the manager dropdown is populated.
7. How My Team uses the hierarchy.
8. How request approval uses the hierarchy.
9. How historical requests preserve their original approver.
10. How Leave Types are managed.
11. Whether the data is persistent or still mock/development data.
12. What remains before the HR Portal can be considered production-ready.