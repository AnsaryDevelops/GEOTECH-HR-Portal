Fix the Manager "My Team" page.

The current page displays:

"My Team
Team directory will be available in the next release."

This is no longer acceptable because My Team is part of V1.

Do NOT redesign the overall application shell. Use the existing design system and components.

==================================================
1. MAKE MY TEAM FUNCTIONAL
==================================================

Replace the placeholder message with a real team directory.

For the authenticated Manager, retrieve all employees whose:

employee.manager_id == authenticated_manager.employee_id

The logged-in manager must only see employees who directly report to them.

Do NOT hard-code the team members into the UI.

Do NOT create a separate manually maintained team list.

The employee hierarchy is the source of truth.

==================================================
2. MY TEAM PAGE
==================================================

Page title:

"My Team"

Supporting text:

"Employees who report directly to you."

Show a team summary near the top:

"Your Team"
[ number of direct reports ]

Then display the employees in a clean table/list.

Each employee should show:

- Employee name
- Employee number
- Position
- Department
- Email
- Account status

Example:

Name              Employee ID    Position          Department    Status
Ahmed El Ansary   EMP-00001      Product Designer  IT            Active
Omar Hassan      EMP-00002      Developer          IT            Active

Use the existing table component if one already exists.

Do not create a new table component if an existing reusable table can be used.

==================================================
3. SEARCH
==================================================

Add a simple search field:

"Search team members..."

Search should filter the currently authenticated manager's direct reports.

Search by:

- Employee name
- Employee number

Do not search the entire organization from the Manager My Team page.

==================================================
4. EMPLOYEE DETAILS
==================================================

Clicking an employee should open an Employee Details view.

Show:

- Full name
- Employee ID
- Position
- Department
- Email
- Phone if available
- Account status
- Direct manager

The Manager should not be able to edit employee hierarchy or employee information from this page.

This is a view-only experience for managers in V1.

==================================================
5. EMPTY STATE
==================================================

If the manager has no direct reports, show:

"No team members yet"

"Employees assigned to you will appear here."

Do NOT show:

"Team directory will be available in the next release."

==================================================
6. LOADING STATE
==================================================

While loading the team:

Show a proper loading state/skeleton using the existing design system.

Do not show an empty page while data is loading.

==================================================
7. ERROR STATE
==================================================

If the team cannot be loaded:

"Something went wrong. We couldn't load your team."

Provide:

[ Try Again ]

Do not expose technical/database errors.

==================================================
8. SECURITY
==================================================

This is extremely important.

The Manager My Team endpoint/query must be restricted to the authenticated manager.

A manager must NOT be able to retrieve another manager's team by changing a URL parameter or employee/manager ID.

Do not trust a manager ID supplied by the frontend.

Determine the manager from the authenticated session.

The backend/server must enforce the relationship:

employees.manager_id == authenticated_manager.employee_id

==================================================
9. TEST WITH THE EXISTING MANAGER ACCOUNT
==================================================

Use the existing Manager test account:

Jordan Lee

Verify that Jordan's My Team page retrieves the employees assigned to Jordan in the existing employee data.

If there are currently no employees assigned to Jordan, create appropriate development/test employee records so the functionality can be verified.

Do not simply display fake employees in the UI.

The test employees must exist in the application's data layer and have:

manager_id = Jordan Lee's employee ID

==================================================
10. INTEGRATION WITH REQUESTS
==================================================

The My Team page must use the SAME employee hierarchy that controls request approval.

For example:

Jordan Lee
↓
Ahmed El Ansary

If Ahmed submits a request:

Ahmed's request approver must be Jordan.

Jordan should then see Ahmed's request in the Manager Requests page.

The My Team relationship and Request Approval relationship must come from the same manager/employee data relationship.

Do not create separate logic for My Team and request approval.

==================================================
11. DO NOT CHANGE
==================================================

Do not change:

- Login
- Authentication
- Existing role system
- Application shell
- Existing navigation
- Existing visual design system
- Employee Dashboard
- HR functionality

Only replace the My Team placeholder with the functional V1 implementation.

==================================================
12. TEST
==================================================

Verify:

Manager logs in
↓
Clicks My Team
↓
Team members load from database
↓
Only direct reports are shown
↓
Search works
↓
Employee Details opens
↓
Manager cannot edit employee hierarchy
↓
No direct reports produces the correct empty state

Then verify the relationship:

Employee assigned to Jordan
↓
Employee submits request
↓
Jordan receives request
↓
Jordan can review it

Employee assigned to another manager
↓
Jordan must NOT see that employee as a direct report
↓
Jordan must NOT receive that employee's request

At the end, report exactly what was implemented and whether the data is coming from the persistent data layer or is still using development/mock data.