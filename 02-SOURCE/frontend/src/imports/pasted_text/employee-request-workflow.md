Now complete the Employee Request workflow.

The existing HR Portal already has:
- Login and authentication
- Employee, Manager, and HR test users
- Role-based dashboards
- Employee Dashboard
- My Requests
- Manager Dashboard
- HR Dashboard
- Existing design system and reusable components

Do NOT rebuild or redesign the existing application.

Use the existing design system, components, navigation, typography, Graphik font, colors, spacing, cards, buttons, status badges, and application shell.

The missing functionality is the Employee "New Request" workflow.

Build the following end-to-end flow:

Employee Dashboard
↓
New Request
↓
Choose Request Type
↓
Leave or Mission
↓
Request Form
↓
Submit Request
↓
Request Confirmation
↓
My Requests
↓
Request Details

==================================================
1. EMPLOYEE DASHBOARD — NEW REQUEST
==================================================

Add a clearly visible primary action:

"New Request"

This should be one of the most prominent actions on the Employee Dashboard.

The Employee Dashboard should allow the employee to quickly choose:

[ New Request ]

Do not add unnecessary request types.

V1 supports only:
- Leave
- Mission

==================================================
2. NEW REQUEST SCREEN
==================================================

Create:

E02 — New Request

Page title:
"New Request"

Supporting text:
"Choose the type of request you want to submit."

Present two clear request options:

LEAVE
Request time off from work.

MISSION
Request a work mission.

Each option should be clickable and visually consistent with the existing design system.

Selecting Leave opens the Leave Request form.

Selecting Mission opens the Mission Request form.

==================================================
3. LEAVE REQUEST FORM
==================================================

Create:

E03 — Request Leave

The form must contain:

Leave Type *
[ Select Leave Type ]

Start Date *
[ Date ]

End Date *
[ Date ]

Reason
[ Text Area ]

Approver

[ Manager name ]
Direct Manager

The Approver section is informational only.

The employee MUST NOT be able to change the approver.

The system must automatically retrieve the employee's direct manager from the employee hierarchy.

Do not allow the employee to select a different manager.

Actions:

[ Cancel ]

[ Submit Request ]

==================================================
4. LEAVE VALIDATION
==================================================

Required:

- Leave Type
- Start Date
- End Date

Validation:

- Leave Type is required.
- Start Date is required.
- End Date is required.
- End Date cannot be before Start Date.
- Leave Type must be active.
- Employee must have an active direct manager.

Prevent overlapping Leave requests for the same employee when an existing request is Pending or Approved.

Display validation errors next to the relevant fields.

Do not rely only on a general error message.

==================================================
5. MISSION REQUEST FORM
==================================================

Create:

E04 — Request Mission

The form must contain:

Start Date *
[ Date ]

Start Time *
[ Time ]

End Date *
[ Date ]

End Time *
[ Time ]

Location *
[ Text Input ]

Purpose *
[ Text Area ]

Approver

[ Manager name ]
Direct Manager

The approver is informational and cannot be changed.

Actions:

[ Cancel ]

[ Submit Request ]

==================================================
6. MISSION VALIDATION
==================================================

Required:

- Start Date
- Start Time
- End Date
- End Time
- Location
- Purpose

Validation:

- All required fields must be completed.
- End date/time must be after Start date/time.
- Employee must have an active direct manager.

Show clear field-level validation.

==================================================
7. SUBMISSION BEHAVIOR
==================================================

When the employee clicks:

"Submit Request"

The application must:

1. Validate the form.
2. Disable the submit button while processing.
3. Show a loading state such as:
   "Submitting..."
4. Create a real request record.
5. Automatically determine:
   - Employee
   - Direct manager
   - Approver
   - Request type
   - Status
6. Set the initial request status to:

PENDING

7. Generate a request number.
8. Create a notification for the employee's direct manager.
9. Redirect the employee to the request confirmation/details view.

Do NOT allow the frontend to choose the employee or approver.

The authenticated user determines the employee.

The employee's manager comes from the employee hierarchy.

==================================================
8. REQUEST CONFIRMATION
==================================================

After successful submission, show a clear success state.

Example:

"Request submitted successfully"

"Your request has been sent to your direct manager for approval."

Show:

- Request number
- Request type
- Requested dates
- Status: Pending
- Approver

Provide:

[ View Request ]

[ Back to Dashboard ]

==================================================
9. MY REQUESTS
==================================================

The existing My Requests screen should now display the newly created request.

Use the existing request list/table components.

Each request should show:

- Request Number
- Request Type
- Date / Period
- Submitted Date
- Status

Statuses:

Pending
Approved
Rejected

Selecting the request opens Request Details.

==================================================
10. REQUEST DETAILS
==================================================

Make the existing Request Details screen functional with the new request data.

For an Employee, show:

Request Number
Status
Request Type
Employee
Direct Manager
Request dates/times
Leave Type if applicable
Location if applicable
Reason/Purpose
Comments
Request Timeline

Example timeline:

✓ Submitted
● Pending Manager Approval
○ Decision

When approved:

✓ Submitted
✓ Manager Reviewed
✓ Approved

When rejected:

✓ Submitted
✓ Manager Reviewed
✕ Rejected

If rejected, display the manager's rejection comment clearly.

Employees must not see approval/rejection controls.

==================================================
11. MANAGER WORKFLOW
==================================================

Because this request is now real, connect it to the existing Manager workflow.

When an employee submits a request:

Manager receives an in-app notification.

The request appears in the manager's pending requests.

Manager can open it and:

[ Approve ]

[ Reject ]

If Reject is selected:

Open a confirmation/rejection dialog requiring a comment.

The rejection comment is mandatory.

After approval:

PENDING → APPROVED

After rejection:

PENDING → REJECTED

Do not allow a request that is already Approved or Rejected to be approved/rejected again.

==================================================
12. EMPLOYEE NOTIFICATION
==================================================

When the manager approves:

Create an in-app notification for the employee:

"Your [request type] request has been approved."

When rejected:

"Your [request type] request has been rejected."

The employee should be able to open the notification and navigate to the relevant Request Details page.

For rejection, show the manager's comment.

==================================================
13. IMPORTANT DATA RULES
==================================================

Do not create fake UI-only requests.

The request must be stored in the application's data layer.

The request must have relationships to:

- Employee
- Approver/Manager
- Request Type
- Leave Type when applicable

Use the existing data model where possible.

Do not create duplicate data structures if the application already has them.

==================================================
14. DO NOT CHANGE
==================================================

Do NOT change:

- Login
- Authentication
- Existing role system
- Existing application shell
- Existing branding
- Graphik typography
- Existing navigation
- Existing dashboard structure unless required to add the New Request action
- Existing HR functionality

Reuse what already exists.

==================================================
15. TEST THE COMPLETE FLOW
==================================================

Test using the existing Employee test account.

Test:

Employee Login
↓
Employee Dashboard
↓
New Request
↓
Leave
↓
Complete form
↓
Submit
↓
Request created
↓
Pending
↓
Manager notification
↓
Manager Dashboard
↓
Manager opens request
↓
Approve
↓
Employee notification
↓
Employee opens request
↓
Status = Approved

Then test rejection:

Employee creates Mission request
↓
Manager receives request
↓
Manager rejects
↓
Manager enters rejection comment
↓
Employee receives notification
↓
Employee opens request
↓
Status = Rejected
↓
Rejection comment is visible

Also test validation and unauthorized behavior.

==================================================
16. FINAL REQUIREMENT
==================================================

Do not proceed to additional features after completing this workflow.

First make sure this complete Employee → Manager approval workflow is functional.

At the end, report:

1. What was implemented.
2. Which existing components were reused.
3. How requests are stored.
4. How manager routing works.
5. How notifications work.
6. What was tested.
7. Any remaining limitations or assumptions.