# Quick Start: E-Ticket System

## 🚀 Get Started in 5 Minutes

### Step 1: Restart Backend Server
```bash
# Kill existing process (if port conflict exists)
# In PowerShell:
Get-Process -Name node | Stop-Process -Force

# Or in nodemon terminal, type:
rs

# Then navigate to backend:
cd x:\new_safaritix\backend_v2
npm start
```

### Step 2: Start Frontend
```bash
# In new terminal:
cd x:\new_safaritix\project_safatiTix-developer
npm run dev
```

### Step 3: Test the System
1. Open browser: `http://localhost:3000`
2. Login as commuter (micomyizaa742@gmail.com)
3. Book a ticket
4. Check your email! 🎉

---

## ✅ What's Already Configured

✅ Gmail SMTP configured (laurentniyigena1@gmail.com)  
✅ Professional HTML e-ticket template  
✅ QR code generation  
✅ Ticket verification endpoints  
✅ Frontend using local backend  
✅ All booking controllers updated  

---

## 📧 Test Email Directly

```bash
cd backend_v2
node scripts/test-email-service.js
```

Should receive test email within 30 seconds.

---

## 🔍 Check Backend Logs

Look for these messages:
```
📧 Preparing to send e-ticket email to user@email.com
✅ E-ticket email sent successfully to user@email.com
```

If you see this:
```
❌ Failed to send e-ticket email: [error]
```
Check:
1. Gmail SMTP password correct in `.env`
2. Internet connection active
3. Gmail account allows "less secure apps" or use App Password

---

## 🎯 Quick Verification Test

Test QR verification endpoint:
```bash
# Using curl:
curl http://localhost:5000/api/tickets/verify/BK-2026-ABC123

# Using browser:
http://localhost:5000/api/tickets/verify/YOUR-BOOKING-REF
```

---

## 📱 What the E-Ticket Looks Like

**Subject:** 🎫 SafariTix E-Ticket: Kigali → Musanze | Seat A1

**Content:**
- Professional SafariTix branded header
- Booking confirmation badge
- Passenger details (name, email, phone)
- Large trip summary (origin → destination)
- Departure date/time, seat number, bus number
- Payment breakdown
- QR code (150x150px)
- Action buttons (View/Cancel ticket)
- Important boarding instructions
- Contact information

---

## 🐛 Quick Fixes

### Port 5000 Already in Use
```powershell
Get-Process -Name node | Stop-Process -Force
```

### Email Not Arriving
1. Check spam folder
2. Verify email in user profile is correct
3. Run test script: `node scripts/test-email-service.js`
4. Check backend logs for errors

### QR Code Missing
- Should be embedded as base64 (no dependencies)
- Check browser console for errors
- Verify `qrcode` package installed

---

## 📝 Environment Variables Required

Ensure these exist in `backend_v2/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=laurentniyigena1@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=laurentniyigena1@gmail.com
SMTP_FROM_NAME=SafariTix - Bus Booking
```

---

## 🎊 Success Indicators

You'll know it's working when:
- ✅ Backend logs show "E-ticket email sent successfully"
- ✅ Email arrives within 1 minute
- ✅ Email displays professionally formatted
- ✅ QR code is visible and scannable
- ✅ All ticket details are correct
- ✅ Verification endpoint returns ticket data

---

## 🔗 Useful Files

- **Main E-Ticket Service:** `services/eTicketService.js`
- **Verification Controller:** `controllers/ticketVerificationController.js`
- **Seat Booking:** `controllers/seatController.js`
- **Payment Booking:** `controllers/paymentController.js`
- **Test Scripts:** `scripts/test-email-service.js`
- **Full Documentation:** `E_TICKET_SYSTEM_DOCUMENTATION.md`

---

**Need Help?** Check [E_TICKET_SYSTEM_DOCUMENTATION.md](./E_TICKET_SYSTEM_DOCUMENTATION.md) for detailed troubleshooting.
