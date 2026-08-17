# OmniMindAI - Production AI Credit, Monetization & Payment System

OmniMindAI is an enterprise multi-agent AI workspace featuring an application-level AI Credit system, MongoDB plan management, Razorpay payment integration, role-based access control, admin management, credit ledger auditing, and AI usage tracking.

---

## 🌟 Key Features

1. **100 Free AI Credits**: Every newly registered user automatically receives 100 free AI credits upon sign-up (granted idempotently once).
2. **Centralized Billing Configuration**: Single source of truth for agent execution credit costs.
3. **Credit Reservation & Deduction Strategy**: Credits are charged **only** after a billable agent completes execution successfully. Failed executions, errors, or timeouts incur **0 permanent credit deduction**.
4. **Atomic Credit Balance Safety**: Utilizes MongoDB `$gte` balance updates and reservations to ensure balances never become negative and concurrent requests cannot double-spend.
5. **Razorpay Payment Integration**: Server-side Razorpay order creation based strictly on MongoDB plan prices (prices and credit values are never trusted from the frontend). HMAC SHA256 signature verification and idempotent webhook processing.
6. **Role-Based Authorization & Security**: Strict role enforcement (`"user"` | `"admin"`). Admin endpoints require authentication plus admin role validation (`403 Forbidden` for normal users).
7. **Admin Management Dashboard**: Complete UI and API capabilities for creating/editing/deactivating plans, manually adjusting user credit balances with audit logs, and viewing payment & AI usage metrics.
8. **Idempotent Migration Strategy**: Migration utilities to safely backfill legacy users with roles and credit accounts without duplicate credit grants.

---

## 💰 Agent Credit Costs Configuration

All credit costs are managed centrally in `backend/services/agent/utils/billing_service.py`:

```python
AGENT_CREDIT_COSTS = {
    "manager": 0,         # Free orchestration
    "clarification": 0,   # Free requirement gathering
    "chat": 2,            # 2 credits
    "search": 5,          # 5 credits
    "rag": 5,             # 5 credits
    "coding": 5,          # 5 credits
    "ppt": 10,            # 10 credits
    "image": 10,          # 10 credits
    "pdf": 10,            # 10 credits
    "ppt_test": 2,        # 2 credits
    "review": 2           # 2 credits
}
```

---

## 🗄️ Database Schemas (MongoDB)

### 1. User Schema (`User`)
- `firebaseUID`: Unique Firebase UID.
- `name`, `email`, `avatar`: Basic user profile fields.
- `role`: `"user"` | `"admin"` (default `"user"`).

### 2. Credit Account (`CreditAccount`)
- `userId`: Unique reference to User ID.
- `balance`: Available AI credit balance (min 0).
- `totalGranted`: Cumulative granted credits.
- `totalPurchased`: Cumulative purchased credits.
- `totalConsumed`: Cumulative consumed credits.
- `reserved`: Transient reserved credits during agent execution.

### 3. Credit Transaction (`CreditTransaction`)
- `userId`: Reference to User ID.
- `type`: `FREE_GRANT` | `PURCHASE` | `USAGE` | `REFUND` | `ADMIN_ADJUSTMENT`.
- `amount`: Credit change (+ or -).
- `balanceBefore`, `balanceAfter`: Auditable balance state.
- `source`: Transaction origin (`SYSTEM`, `RAZORPAY`, `AI_WORKFLOW`, `ADMIN`).
- `referenceId`: Unique idempotency key.
- `description`: Human-readable summary.

### 4. AI Usage (`AIUsage`)
- `userId`, `conversationId`, `taskId`, `messageId`.
- `agent`: Agent name executed.
- `model`: LLM model used.
- `creditCost`: Permanent credit cost charged.
- `status`: `"success"` | `"failed"`.

### 5. Plan Schema (`Plan`)
- `name`: Plan title (e.g. Starter, Pro).
- `description`: Plan details.
- `price`: Price in paise (e.g. ₹100 = 10000 paise).
- `currency`: Default `"INR"`.
- `credits`: AI Credits provided.
- `isActive`: Boolean flag for plan availability.

### 6. Purchase Schema (`Purchase`)
- `userId`, `planId`, `amount`, `currency`, `creditsGranted`.
- `status`: `PENDING` | `SUCCESS` | `FAILED` | `CANCELLED` | `REFUNDED`.
- `razorpayOrderId`: Unique Razorpay Order ID.
- `razorpayPaymentId`: Unique Razorpay Payment ID.
- `razorpaySignature`: Server-verified payment signature.

---

## 🔐 Admin Setup & Manual Promotion

1. User registers normally through Google Auth (`role = "user"`).
2. To promote a user to Admin, manually update the user document in MongoDB:
   ```javascript
   db.users.updateOne(
     { email: "admin@example.com" },
     { $set: { role: "admin" } }
   )
   ```
3. Once updated, the user gets access to the Admin Dashboard and Admin APIs (`/admin/*`). All unauthorized users attempting to access admin APIs receive `403 Forbidden`.

---

## 💳 Razorpay Payment Setup & Environment Variables

Add the following environment variables to `backend/services/auth/.env` and `backend/gateway/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Payment Verification Flow
1. **Frontend** sends `planId` to `POST /payments/create-order`.
2. **Backend** loads active `Plan` from MongoDB, reads trusted `price` & `credits`, creates Razorpay Order, and creates `PENDING` `Purchase`.
3. **Frontend** launches Razorpay Checkout.
4. **Server Verification**: `POST /payments/verify` verifies HMAC SHA256 signature (`order_id + "|" + payment_id` against `RAZORPAY_KEY_SECRET`).
5. **Idempotent Credit Allocation**: Atomically increments `CreditAccount.balance` and logs `CreditTransaction` (`PURCHASE`).

---

## ⚡ API Endpoints Summary

### User Endpoints
- `GET /me/credits`: Fetch current credit balance and summary.
- `GET /me/credits/transactions`: Fetch auditable credit ledger history.
- `GET /me/usage`: Fetch AI agent execution history.
- `GET /plans`: Fetch active credit purchase plans.
- `GET /plans/:id`: Fetch specific plan details.
- `POST /payments/create-order`: Create Razorpay payment order for selected `planId`.
- `POST /payments/verify`: Server-side payment signature verification.
- `POST /payments/webhook`: Webhook handler for Razorpay payment events.

### Admin Endpoints (Auth + Admin Role Required)
- `GET /admin/plans`: List all plans (active & inactive).
- `POST /admin/plans`: Create new plan.
- `PATCH /admin/plans/:id`: Update existing plan.
- `DELETE /admin/plans/:id`: Safe plan deletion (soft-deactivates if purchased).
- `GET /admin/users`: List users & credit balances.
- `GET /admin/users/:id`: Get detailed user credit profile.
- `POST /admin/users/:id/credits/adjust`: Manual credit adjustment (+ or -).
- `GET /admin/purchases`: View all payment orders.
- `GET /admin/credit-transactions`: View all ledger entries.
- `GET /admin/usage`: View system-wide AI usage logs.

---

## 🧪 Development & Testing

Run the automated 43-scenario test suite:

```bash
cd backend
.\services\agent\.venv\Scripts\python.exe test_suite.py
```
