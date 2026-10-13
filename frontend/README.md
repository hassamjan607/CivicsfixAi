# CivicFix AI — Municipal Grievance Redressal Platform

CivicFix AI is a responsive, multi-role web platform for municipal complaint triage, automated urgency scoring, departmental routing, field worker dispatch, and photographic proof verification.

---

## 1. Quick Start & Run Commands

```bash
# Navigate to the frontend workspace
cd frontend

# Install dependencies (Next.js, Prisma, Bcrypt, Tailwind)
npm install

# Initialize SQLite database and push schema
npx prisma db push

# Seed demo accounts, departments, and showcase complaints
npm run seed

# Start the application server (runs at http://localhost:3000)
npm run dev

# Run automated end-to-end integration workflow test
node scripts/test-workflow.js
```

---

## 2. Environment Configuration (`.env.example`)

Copy `.env.example` to `.env` or `.env.local`:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="civicfix-jwt-super-secret-key-32-chars-long-2026"
EMAIL_PROVIDER="console" # console | smtp | resend
EMAIL_API_KEY=""
EMAIL_FROM="CivicFix Municipal Alert <alerts@civicfix.gov.pk>"
APP_URL="http://localhost:3000"
SIGNED_LINK_SECRET="civicfix-hmac-signed-token-secret-2026"
NEXT_PUBLIC_DEMO_MODE="true"
AUTO_CLOSE_DAYS="7"
```

---

## 3. Seeded Demo Accounts

All accounts use default password: `Password123!` (or log in instantly with 1-click via the floating **Demo Tools** menu):

| Role | Name | Email | Scope |
|---|---|---|---|
| **Citizen** | Hamza Malik | `citizen1@gmail.com` | Own complaints only, confirmation & reopen |
| **Citizen** | Fatima Bibi | `citizen2@gmail.com` | Own complaints only |
| **Citizen** | Zainab Tariq | `citizen3@gmail.com` | Own complaints only |
| **Officer (WASA)** | Officer Tariq Mehmood | `officer.wasa@civicfix.gov.pk` | Water & Sanitation complaints only; assigns workers |
| **Officer (TEPA)** | Officer Bilal Asghar | `officer.tepa@civicfix.gov.pk` | Roads & Traffic complaints only; assigns workers |
| **Worker (WASA)** | Farhan Qureshi (Pipe Tech) | `worker1.wasa@civicfix.gov.pk` | Assigned WASA jobs; photo upload & completion |
| **Worker (WASA)** | Usman Liaquat (Sewer Crew) | `worker2.wasa@civicfix.gov.pk` | Assigned WASA jobs |
| **Worker (TEPA)** | Rashid Minhas (Road Crew) | `worker1.tepa@civicfix.gov.pk` | Assigned TEPA road repair jobs |
| **Admin** | Ayesha Khan (Commissioner) | `admin@civicfix.gov.pk` | City-wide oversight, audit log, user management, email outbox |

---

## 4. End-to-End Walkthrough & Demo Path

### Path A: Clean Resolution Cycle
1. **Citizen Reports by Voice with Photo**:
   - Navigate to `/login` &rarr; click **Demo as Citizen** (or open `/citizen/report`).
   - Choose **Talk** (mic button), **Type**, or **Form** mode.
   - Speak or select "Hamari gali mein gutter ubal raha hai" and attach a photo.
   - Click **Submit Complaint**.
   - Review the result card: Shows tracking reference (e.g. `CF-1042`), explainable urgency score (e.g. 7/10), and routing: *"Sent to Water & Sanitation Agency (WASA), being reviewed by Department Officer"*.
2. **Department Officer Reviews & Dispatches**:
   - Open `/login` &rarr; click **Demo as Officer** (or navigate to `/officer`).
   - Notice the department-scoped queue (WASA tickets only; TEPA tickets are invisible).
   - Click the ticket to review AI urgency reasons, map location, and citizen description.
   - Click **Assign to Worker** &rarr; select *Farhan Qureshi* (shows current open workload) and add instructions.
   - Ticket status transitions to `ASSIGNED`. Worker receives alert.
3. **Field Worker Resolves with 'After' Photo**:
   - Open `/login` &rarr; click **Demo as Worker** (or open `/worker`).
   - The assigned job appears in the mobile-first queue with SLA timer.
   - Tap **Start Job** &rarr; status updates to `IN_PROGRESS`.
   - On the repair form, open camera / attach an **'After' Photo** (mandatory).
   - Select equipment used (e.g. *Suction Pump*, *Chlorine Spray*) and dictate a voice note.
   - Click **Mark as Resolved** &rarr; status becomes `RESOLVED`.
4. **Citizen Inspects Proof & Confirms Fix**:
   - Switch back to Citizen dashboard (`/citizen`).
   - The **Action Required** banner alerts: *"A municipal crew marked your complaint fixed!"*.
   - Tap to open the complaint &rarr; drag the **Before & After slider** to inspect the photo proof.
   - Click **Yes, Confirm Fix** &rarr; provide a 5-star rating. Status transitions to `CONFIRMED` and closes.

### Path B: Reopen Rejection Workflow
- Citizen views a resolved ticket &rarr; clicks **Not Fixed (Reopen)**.
- Enters required explanation: *"Water is still leaking under the curb"*.
- Complaint transitions to `REOPENED` &rarr; reappears with high-priority flag in Officer's queue.

### Path C: Administrator Governance
- Navigate to `/admin` &rarr; inspect live city overview counters, resolution rate, and overdue escalations.
- Check `/admin/audit` &rarr; verify the complete immutable state machine event log with actors and timestamps.
- Check `/admin/emails` &rarr; inspect background automated email delivery logs with resend capability.
- Check `/admin/simulator` &rarr; test the deterministic scoring engine with plain-language community scenarios.

---

## 5. Security & Architectural Guarantees

- **Server-Side Authorization**: Every Next.js Route Handler validates JWT sessions and role scopes (`db` queries filter by `userId`, `departmentId`, and `assignedWorkerId`).
- **No Specification Jargon**: User interface labels are plain English and Urdu (no "FR-18", "Section 8", or "Page 2" references).
- **Photographic Verification**: Slider handle never overlaps caption tags; worker cannot resolve tickets without attaching proof.
- **Background Automation**: SLA monitoring, 48-hour citizen reminders, and 7-day auto-closure handled via background cron (`/api/admin/cron`).
