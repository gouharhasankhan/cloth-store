# FashionHub - Cloth Store

Node.js + EJS + MySQL E-Commerce Website with Razorpay Payment Gateway

## Features
- Product listing, cart, orders
- User authentication
- Admin panel
- **Razorpay payment** (UPI, Card, Net Banking)
- Cash on Delivery
- Railway MySQL compatible

---

## Local Development

```bash
npm install
# .env file banao (neeche dekho)
npm run dev
```

---

## Environment Variables (.env)

```
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Gouhar@123
DB_NAME=cloth_store

SESSION_SECRET=any-long-random-string-here

APP_NAME=FashionHub

RAZORPAY_KEY_ID=rzp_test_SxVjPjCLIjL62Q
RAZORPAY_KEY_SECRET=JNhfQS6T7XOSKJ3qvQrjooKv
```

---

## GitHub pe Push kaise karein

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/gouharhasankhan/cloth-store.git

git push -u origin main
```

---

## Railway pe Deploy kaise karein

### Step 1: Railway MySQL Database

1. [railway.app](https://railway.app) pe jaao
2. New Project > Add MySQL
3. MySQL service ke Variables tab mein se copy karein:
   - `MYSQLHOST`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQL_DATABASE`
   - `MYSQLPORT`

### Step 2: Node.js Service

1. New Service > GitHub Repo select karein
2. Variables tab mein ye add karein:

```
NODE_ENV=production
SESSION_SECRET=koi-bhi-lamba-random-string
APP_NAME=FashionHub
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx

# Railway MySQL ke values copy karein:
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQL_DATABASE}}
```

> **Tip:** Railway mein `${{MySQL.MYSQLHOST}}` likhne se automatically MySQL service ke values aa jaati hain.

3. Deploy ho jaayega automatically!

---

## Render pe Deploy kaise karein

1. [render.com](https://render.com) pe New Web Service banao
2. GitHub repo connect karein
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Environment Variables mein Railway MySQL ke values daalo (ya Render ka PostgreSQL use karo)

---

## Razorpay Setup

1. [razorpay.com](https://razorpay.com) pe account banao
2. Settings > API Keys > Generate Test Key
3. `rzp_test_...` key ko `.env` mein daalo
4. Live ke liye: Test keys ko Live keys se replace karein

**Test Cards:**
- Card: `4111 1111 1111 1111` | Expiry: any future | CVV: any
- UPI: `success@razorpay`

---

## Admin Login
- Email: `admin@fashionhub.com`
- Password: `admin123`
