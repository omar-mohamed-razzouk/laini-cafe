# دليل تثبيت BrewDesk على سيرفرك الخاص

## المتطلبات

| البرنامج | الإصدار المطلوب |
|---------|----------------|
| Node.js | 20 أو أحدث |
| pnpm | 10 أو أحدث |
| PostgreSQL | 14 أو أحدث |

---

## الخطوة 1 — تثبيت Node.js و pnpm

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
npm install -g pnpm
```

---

## الخطوة 2 — تثبيت PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# إنشاء قاعدة بيانات
sudo -u postgres psql -c "CREATE USER brewdesk WITH PASSWORD 'ضع_كلمة_مرور_قوية_هنا';"
sudo -u postgres psql -c "CREATE DATABASE brewdesk OWNER brewdesk;"
```

---

## الخطوة 3 — رفع الملفات

```bash
# انسخ محتويات الملف المضغوط إلى السيرفر
# مثال باستخدام scp:
scp brewdesk-source.zip user@ip-السيرفر:/home/user/
ssh user@ip-السيرفر
unzip brewdesk-source.zip -d brewdesk
cd brewdesk
```

---

## الخطوة 4 — ضبط المتغيرات البيئية

```bash
# في مجلد المشروع، أنشئ ملف .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://brewdesk:ضع_كلمة_مرور_قوية_هنا@localhost:5432/brewdesk
SESSION_SECRET=اكتب_نص_عشوائي_طويل_هنا_مثلاً_50_حرف
ADMIN_PASSWORD=كلمة_مرور_الأدمن_الجديدة
NODE_ENV=production
PORT=8080
EOF
```

---

## الخطوة 5 — تثبيت المكتبات وبناء المشروع

```bash
# تثبيت المكتبات
pnpm install

# تشغيل migrations (إنشاء جداول قاعدة البيانات)
pnpm --filter @workspace/db run push

# بناء API Server
pnpm --filter @workspace/api-server run build

# بناء الواجهة الأمامية (frontend)
pnpm --filter @workspace/brewdesk run build
```

---

## الخطوة 6 — تثبيت وضبط nginx (الموصى به)

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/brewdesk > /dev/null << 'EOF'
server {
    listen 80;
    server_name اكتب_اسم_الدومين_أو_IP_هنا;

    # الواجهة الأمامية (ملفات ثابتة)
    root /home/user/brewdesk/artifacts/brewdesk/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /downloads/ {
        alias /home/user/brewdesk/artifacts/brewdesk/dist/downloads/;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/brewdesk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## الخطوة 7 — تشغيل الـ API Server بشكل دائم (PM2)

```bash
npm install -g pm2

# تشغيل السيرفر
cd /home/user/brewdesk
pm2 start artifacts/api-server/dist/index.mjs --name "brewdesk-api" --env production

# تشغيل تلقائي عند إعادة تشغيل السيرفر
pm2 startup
pm2 save
```

---

## الخطوة 8 — التحقق من التشغيل

```bash
# تحقق من حالة السيرفر
pm2 status

# تحقق من الـ API
curl http://localhost:8080/api/health

# اعرض السجلات
pm2 logs brewdesk-api
```

---

## ملاحظات مهمة

- **HTTPS**: يُنصح باستخدام Let's Encrypt مع certbot لتفعيل HTTPS
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d اسم_الدومين
  ```

- **ADMIN_PASSWORD**: كلمة مرور حساب admin في قاعدة البيانات تُعيَّن تلقائياً من المتغير البيئي عند أول تشغيل

- **النسخ الاحتياطي**: خذ نسخة من قاعدة البيانات بانتظام:
  ```bash
  pg_dump -U brewdesk brewdesk > backup-$(date +%Y%m%d).sql
  ```

- **التحديث**: عند تحديث الكود، أعد تشغيل الخطوات 5 و 7 فقط

---

## هيكل المشروع

```
brewdesk/
├── artifacts/
│   ├── api-server/     ← الباك-إند (Express + Node.js)
│   │   └── dist/       ← بعد البناء
│   └── brewdesk/       ← الفرونت-إند (React + Vite)
│       └── dist/       ← بعد البناء (ارفعه على nginx)
├── lib/
│   ├── db/             ← مخطط قاعدة البيانات (Drizzle ORM)
│   ├── api-spec/       ← مواصفات الـ API (OpenAPI)
│   └── api-client-react/ ← Hooks مولدة تلقائياً
└── .env                ← المتغيرات البيئية (أنشئه يدوياً)
```

---

## المتطلبات البيئية الكاملة

| المتغير | الوصف | مثال |
|---------|-------|------|
| `DATABASE_URL` | رابط قاعدة البيانات | `postgresql://user:pass@localhost:5432/brewdesk` |
| `SESSION_SECRET` | مفتاح تشفير الجلسات (عشوائي طويل) | أي نص 50 حرف |
| `ADMIN_PASSWORD` | كلمة مرور حساب admin | كلمة مرور قوية |
| `NODE_ENV` | بيئة التشغيل | `production` |
| `PORT` | منفذ الـ API | `8080` |

---

*BrewDesk — نظام إدارة كافيه متكامل*
