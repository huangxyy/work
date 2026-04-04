# Homework AI - Testing Checklist

**Date**: 2026-04-04
**Purpose**: Comprehensive manual testing checklist for post-deployment verification

---

## Pre-Deployment Checks

### Environment Setup
- [ ] All environment variables configured in `.env`
- [ ] Run `pnpm config:validate` - all validations pass
- [ ] Database migrations applied: `pnpm prisma:migrate`
- [ ] Frontend built: `pnpm build`
- [ ] No TypeScript errors: `pnpm typecheck`

### Service Health
- [ ] MySQL running and accessible
- [ ] Redis running and accessible
- [ ] MinIO running and accessible
- [ ] Backend API running (port 3000)
- [ ] Worker process running
- [ ] Nginx proxy running (port 80)

---

## Post-Deployment Verification

### Health Check Endpoints
- [ ] `GET /api/public/health` returns `{"status":"ok"}`
- [ ] `GET /api/public/config/validate` shows all configs valid
- [ ] `GET /api/public/queue/status` returns queue info

### Database Connectivity
- [ ] Can connect to database via Prisma Studio
- [ ] All tables exist (User, Class, Homework, Submission, etc.)
- [ ] Seed data exists (admin, teacher, student accounts)

---

## Student End Testing

### Login
- [ ] Login with student account (`student01` / `123456`)
- [ ] Invalid password shows error message
- [ ] Logout works correctly
- [ ] JWT token stored in localStorage

### Dashboard
- [ ] Homework list displays correctly
- [ ] Homework shows deadline, status (pending/submitted)
- [ ] Can switch between pending/completed tabs

### Homework Submission
- [ ] View homework detail page
- [ ] Upload single image - succeeds
- [ ] Upload multiple images (2-3) - succeeds
- [ ] Upload non-image file - shows error
- [ ] Upload exceeds size limit - shows error
- [ ] Submission shows "QUEUED" status initially
- [ ] Page refresh shows updated status

### Submission Results
- [ ] Wait for grading to complete (status changes to "DONE")
- [ ] View grading result page
- [ ] Total score displays correctly
- [ ] Dimension scores (Content, Organization, Language) visible
- [ ] Teacher feedback visible (if provided)
- [ ] Corrected text highlights display
- [ ] Rewritten version visible (if enabled)

### Submission History
- [ ] View all past submissions
- [ ] Filter by homework
- [ ] Filter by status
- [ ] Click to view historical submission details

### Learning Report
- [ ] View personal learning report
- [ ] Score trends chart displays
- [ ] Dimension breakdown visible
- [ ] Common errors listed
- [ ] Progress statistics accurate

---

## Teacher End Testing

### Login
- [ ] Login with teacher account (`teacher01` / `123456`)
- [ ] Dashboard shows class overview
- [ ] Student count displays correctly

### Homework Management
- [ ] Create new homework
  - [ ] Title, description, deadline fields work
  - [ ] Class selection works
  - [ ] Template selection works (if templates exist)
- [ ] Edit existing homework
- [ ] Delete homework (with confirmation)
- [ ] View homework detail with submission list

### Class Management
- [ ] View class list
- [ ] View student list for a class
- [ ] Add student to class (by username)
- [ ] Remove student from class

### Batch Upload - Single Images
- [ ] Navigate to batch upload page
- [ ] Select homework
- [ ] Upload multiple single images
- [ ] Assign student names to each image
- [ ] Submit batch - all submissions created
- [ ] View upload result summary

### Batch Upload - ZIP File
- [ ] Prepare ZIP file with student homework images
- [ ] Upload ZIP file
- [ ] ZIP extraction completes without OOM error
- [ ] Student names auto-detected from filenames
- [ ] Manual assignment for unrecognized files
- [ ] Submit batch - all submissions created
- [ ] Large ZIP (50MB+) processes successfully

### Submission Review
- [ ] View submission detail
- [ ] OCR text displays correctly
- [ ] Grading JSON visible
- [ ] Add teacher feedback
- [ ] Adjust scores (if permitted)
- [ ] Save changes

### Class Report
- [ ] Generate class report for homework
- [ ] Score distribution chart displays
- [ ] Average score calculated correctly
- [ ] Dimension breakdown visible
- [ ] Export to CSV works
- [ ] Export to PDF works (Chinese characters display)

### Student Report
- [ ] View individual student report
- [ ] Student's submission history visible
- [ ] Performance trends chart displays
- [ ] Compare to class average
- [ ] Export to PDF works

### Announcements
- [ ] Create announcement for class
- [ ] Announcement visible to students
- [ ] Delete announcement

### Grading Settings
- [ ] Configure grading policy for class
- [ ] Set LLM mode (cheap/quality)
- [ ] Toggle rewrite generation
- [ ] Save settings persist

---

## Admin End Testing

### Login
- [ ] Login with admin account (`admin` / `123456`)
- [ ] Dashboard loads

### System Metrics
- [ ] View system overview
- [ ] User count displays correctly
- [ ] Submission count accurate
- [ ] Storage usage shown

### User Management
- [ ] View all users list
- [ ] Filter by role (student/teacher/admin)
- [ ] Search by username
- [ ] Create new user
- [ ] Edit user details
- [ ] Delete user (with confirmation)
- [ ] Export users to CSV

### Queue Monitoring
- [ ] Navigate to `/admin/queue`
- [ ] Queue status displays (waiting/active/completed/failed)
- [ ] Worker health status shows as healthy
- [ ] Failed jobs list visible
- [ ] Retry failed job - job reprocesses
- [ ] Delete failed job - job removed
- [ ] Queue trends chart displays
- [ ] Alerts show when issues detected
- [ ] Auto-refresh every 5 seconds

### Configuration
- [ ] View system configuration
- [ ] Settings grouped logically (AI Services, Storage, Budget)
- [ ] Edit non-sensitive settings (budget limits, retention)
- [ ] Sensitive values show as "Configured" only
- [ ] Save configuration changes

### Service Health Tests
- [ ] Test LLM connection - succeeds with valid API key
- [ ] Test OCR connection - succeeds with valid API keys
- [ ] View LLM call logs
- [ ] Check daily quota usage

### Audit Logs
- [ ] View audit log trail
- [ ] Filter by action type
- [ ] Filter by user
- [ ] Filter by date range
- [ ] Export audit logs

---

## Critical Function Stability Tests

### Batch Upload Memory
- [ ] Upload 100MB ZIP file - no OOM error
- [ ] Upload ZIP with 100+ images - processes correctly
- [ ] Progress indicator shows during extraction

### Queue Failure Recovery
- [ ] Stop worker process
- [ ] Create submission - stays in QUEUED
- [ ] Start worker process
- [ ] Submission gets processed
- [ ] Failed job can be retried manually

### PDF Export
- [ ] Export report on Windows - Chinese displays
- [ ] Export report on macOS - Chinese displays
- [ ] Export report on Linux - Chinese displays
- [ ] Large report (50+ students) generates without error

---

## Performance Tests

### Concurrent Load
- [ ] 10 students submit simultaneously - all process
- [ ] Batch upload 50 images - completes in reasonable time
- [ ] Report generation for large class (100+) - completes

### Response Times
- [ ] Page load < 2 seconds
- [ ] API response < 500ms (non-grading endpoints)
- [ ] Grading completes < 30 seconds (typical submission)

---

## Edge Cases

### Invalid Inputs
- [ ] Empty file upload - rejected
- [ ] Corrupted image file - handled gracefully
- [ ] Malformed ZIP file - shows clear error
- [ ] SQL injection attempts - blocked
- [ ] XSS attempts - escaped

### Boundary Conditions
- [ ] Zero submissions in class - report handles gracefully
- [ ] Student with no submissions - shows empty state
- [ ] Homework with no due date - displays correctly
- [ ] Very long homework description - displays properly

---

## Browser Compatibility

- [ ] Chrome/Edge - all features work
- [ ] Firefox - all features work
- [ ] Safari - all features work
- [ ] Mobile browser - basic functionality works

---

## Sign-Off

**Tester**: ___________________
**Date**: ___________________
**Environment**: [ ] Development [ ] Staging [ ] Production

**Critical Issues Found**: ___________
**Passed**: [ ] Yes [ ] No

---

## Notes

Add any observations, issues found, or suggestions for improvement below:

_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
