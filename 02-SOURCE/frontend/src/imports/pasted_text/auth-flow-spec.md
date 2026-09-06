The Login screen is visually established, but the authentication flow is currently not functional.

Now implement the functional authentication and routing behavior for V1.

IMPORTANT:
Do not redesign the Login screen unnecessarily. Preserve the approved visual design, branding, Graphik typography, spacing, colors, and overall layout.

## 1. LOGIN BEHAVIOR

The Login screen must have a real working form.

Fields:
- Employee ID / Username
- Password

The "Sign In" button must:

1. Validate that both fields are populated.
2. Show field-level validation when required fields are missing.
3. Show a loading state while authentication is being processed.
4. Authenticate the user against the application's authentication/data layer.
5. If credentials are valid, establish an authenticated session.
6. Determine the user's role from the authenticated account.
7. Redirect the user to the correct dashboard.

## 2. ROLE-BASED REDIRECTION

After successful authentication:

EMPLOYEE
→ /employee/dashboard

MANAGER
→ /manager/dashboard

HR
→ /hr/dashboard

Do not use the frontend to determine or trust the user's role.

The authenticated user's role must come from the trusted application/backend data.

## 3. SUCCESS STATE

The current green success alert saying:

"Sign-in successful
Welcome back. Redirecting to your dashboard..."

must NOT be visible on the default Login screen.

It should only appear after successful authentication, immediately before redirecting if that behavior is visually useful.

After a successful login, redirect automatically to the correct dashboard.

The user should never remain on the Login screen after successful authentication.

## 4. ERROR STATES

Implement these states:

### Empty fields

Employee ID:
"Employee ID is required."

Password:
"Password is required."

### Invalid credentials

Show a clear message such as:

"Invalid Employee ID or password. Please check your credentials and try again."

Do not expose whether a specific employee ID exists.

### Inactive account

If the credentials belong to an inactive account:

"Your account is inactive. Please contact HR for assistance."

### Authentication/system error

"Something went wrong. Please try again or contact HR if the problem persists."

Never expose technical errors, stack traces, database errors, or internal implementation details.

## 5. SESSION / PROTECTED ROUTES

After successful authentication, maintain an authenticated session.

Protected application routes must not be accessible to unauthenticated users.

If an unauthenticated user attempts to access:

/employee/*
/manager/*
/hr/*

redirect them to the Login screen.

If an authenticated employee attempts to access Manager or HR routes, deny access.

If an authenticated manager attempts to access HR routes, deny access.

Do not rely only on hiding navigation items. Enforce authorization at the application/server level.

## 6. LOGOUT

Add the logout behavior to the authenticated application shell.

When the user signs out:

1. Destroy/invalidate the authenticated session.
2. Redirect to Login.
3. Prevent access to protected pages using browser back navigation.

## 7. ROLE-BASED APPLICATION SHELL

The application shell should now become functional.

Employee sees:

- Dashboard
- My Requests
- Notifications

Manager sees:

- Dashboard
- My Team
- Requests
- Notifications

HR sees:

- Dashboard
- Employees
- Requests
- Notifications
- Settings

The shell must dynamically render based on the authenticated user's role.

## 8. DO NOT BUILD THE FULL DASHBOARDS YET

For this step, create only simple placeholder dashboard pages for testing the routing:

Employee Dashboard:
"Employee Dashboard"

Manager Dashboard:
"Manager Dashboard"

HR Dashboard:
"HR Dashboard"

These are temporary functional destinations.

We will replace them with the actual dashboard designs later.

## 9. DEVELOPMENT TEST ACCOUNTS

The existing demo credentials may be used for development/testing only.

Create or retain test users representing:

Employee
Manager
HR

However, do NOT display demo credentials inside the production Login UI.

The current "Demo credentials" panel should be removed from the visible Login screen.

If test credentials are needed during development, keep them in a development-only mechanism that is not displayed to normal users.

## 10. IMPORTANT

Do not proceed to the Employee Dashboard design yet.

First make this complete flow work:

Login
↓
Authenticate
↓
Determine role
↓
Create session
↓
Role-based redirect
↓
Correct dashboard

Then verify:

Employee → Employee Dashboard
Manager → Manager Dashboard
HR → HR Dashboard
Invalid credentials → Login error
Inactive account → Inactive account error
Unauthenticated protected route → Login
Unauthorized role access → Access denied
Logout → Login

## 11. IMPLEMENTATION QUALITY

Do not fake the redirect with a visual animation.

The navigation must actually change the application route/page.

Do not use hard-coded role checks based on the username.

Do not store passwords in plaintext.

Do not trust role information submitted by the client.

Use the existing architecture and authentication/data layer where available.

If the current project does not yet have a real authentication backend, implement the simplest appropriate authentication foundation supported by the current Figma Make environment and clearly state what remains to be connected to production authentication.

At the end, report:

1. What authentication functionality was implemented.
2. What routes were created.
3. How role-based access works.
4. Which test accounts can be used.
5. Any remaining limitation preventing this from being production-ready.