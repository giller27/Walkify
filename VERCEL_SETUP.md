# 🚀 VERCEL DEPLOYMENT - Environment Variables Setup

## ❌ Проблема

На Vercel показується помилка:

```
Missing Supabase credentials in .env.local
```

Це тому, що `.env.local` містить локальні змінні та не загружається на Vercel.

## ✅ Рішення

### **Крок 1: Отримати значення з `.env.local`**

В вашому проекті, у файлі `.env.local` є:

```env
VITE_SUPABASE_URL=https://vjkxbfwrwkiwmwemtppo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqa3hiZndyd2tpd213ZW10cHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMzg4OTcsImV4cCI6MjA4MDgxNDg5N30.KDN5uEstyEt4Ic1leoutuh0yzML6CeasmMfqAVmGc3E
VITE_GOOGLE_CLIENT_ID=1018401887471-ltpjg1ss448evlj6l8erb1902adpd8tr.apps.googleusercontent.com
VITE_ORS_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE3YzUxNmU2ZmMzYzQyMTQ4OTJhMWM4YWM1YTI2OWQ1IiwiaCI6Im11cm11cjY0In0=
```

### **Крок 2: Додати Environment Variables на Vercel**

1. **Перейти на Vercel:**

   - Відкрити https://vercel.com
   - Увійти в акаунт
   - Перейти на проект **Walkify**

2. **Перейти в Settings:**

   - Клацнути на проект
   - Перейти на вкладку **Settings**
   - Знайти **Environment Variables** у лівому меню

3. **Додати змінні:**
   Додати кожну змінну окремо:

   | Ключ                     | Значення                                                                                                                   |
   | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
   | `VITE_SUPABASE_URL`      | `https://vjkxbfwrwkiwmwemtppo.supabase.co`                                                                                 |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (повне значення)                                                                 |
   | `VITE_GOOGLE_CLIENT_ID`  | `1018401887471-ltpjg1ss448evlj6l8erb1902adpd8tr.apps.googleusercontent.com`                                                |
   | `VITE_ORS_API_KEY`       | `eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE3YzUxNmU2ZmMzYzQyMTQ4OTJhMWM4YWM1YTI2OWQ1IiwiaCI6Im11cm11cjY0In0=` |

4. **Для кожної змінної:**
   - Клацнути "Add New"
   - Введіть Ключ (Name)
   - Введіть Значення (Value)
   - Виберіть середовища: **Production**, **Preview**, **Development**
   - Клацніть "Save"

### **Крок 3: Повторний Deploy**

После додавання змінних:

1. **Поверніться на головну сторінку проекту**
2. **Клацніть на останній Deployment**
3. **Клацніть "Redeploy" або просто зробіть нове commit у GitHub**

Vercel автоматично перебере нові environment variables.

### **Крок 4: Перевірка**

1. Дочекайтеся завершення deployment
2. Відкрийте посилання проекту
3. Відкрийте Console (F12)
4. Повинна бути помилка або успіх:
   - ✅ **Успіх:** Сторінка завантажиться нормально
   - ❌ **Помилка:** Виведеться детальна інформація про невистачаючу змінну

---

## 🔐 **Безпека**

- ✅ Не комітьте `.env.local` у GitHub (вже у `.gitignore`)
- ✅ Environment variables на Vercel приховані від публічного доступу
- ✅ Кожна змінна зашифрована на серверах Vercel

---

## 📝 **Альтернатива: Через Vercel CLI**

Якщо ви встановили Vercel CLI:

```bash
vercel env pull .env.local
```

Це завантажить zminnye з Vercel в локальний файл.

---

## ✅ Завершено!

После додавання всіх environment variables на Vercel, app повинен працювати без помилок!
