
# 🤝 Contributing to Rinse

First off, thank you for considering contributing to Rinse! It is developers like you who make open-source software a genuinely great community. 

Whether you are fixing a typo, squashing a bug, or building a brand new feature for the PG community, your help is incredibly appreciated. 

This document outlines the exact steps to get Rinse running on your local machine and how to submit your changes.

Also please check out [rules.md](./rules/rules.md) file for knowing in more detail about development approach and some rules of thumb. 

---
## 🛠️ Local Development Setup

Rinse uses a React (Vite) frontend with a Supabase backend. To develop locally without affecting the live production database, you will need to spin up your own free Supabase instance.

### Prerequisites
- Node.js 18+
- Git
- A free account on [Supabase](https://supabase.com/)

### Step-by-Step Installation

**1. Fork and Clone**
Click the "Fork" button at the top right of the repository. Then, clone your fork to your local machine:
```bash
git clone [https://github.com/YashodharChavan/rinse.git](https://github.com/YashodharChavan/rinse.git)
cd rinse
```

**2. Install Dependencies**

```bash
npm install
```

**3. Set Up Your Local Database**

* Go to your Supabase dashboard and create a new free project.
* Open the **SQL Editor** in your new project.
* Copy the exact contents of the [`database/schema.sql`](./database/schema.sql) file from this repository and run it. This instantly creates the `pgs`, `profiles`, `machines`, `schedule`, and `join_requests` tables.

**4. Configure Environment Variables**
Create a `.env` file in the root directory. You can find these values in your Supabase Project Settings -> API.

```env
VITE_SUPABASE_URL=[https://your-project-ref.supabase.co](https://your-project-ref.supabase.co)
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**5. Set Up Authentication (Crucial for Login)**
Rinse uses Supabase Auth. To make the local login screen work:

* Go to your Supabase Dashboard -> **Authentication** -> **Providers**.
* Enable the OAuth providers you want to test (e.g., Google or GitHub) and paste in your Client IDs and Secrets.
* Go to **Authentication** -> **URL Configuration** and add `http://localhost:5173` to your **Redirect URLs** list. If you skip this, local logins will be blocked.

**6. Start the App**

```bash
npm run dev
```

Open `http://localhost:5173` to view the app.

---

## 🌿 Branching Strategy

Before writing any code, create a new branch from `main`. Please use descriptive branch names so it is easy to understand what you are working on.

**Prefixes to use:**

* `feat/` - For new features (e.g., `feat/dark-mode`)
* `bugfix/` - For fixing issues (e.g., `bugfix/lazy-sweeper-timing`)
* `docs/` - For updating documentation
* `ui/` - For styling and design tweaks

```bash
git checkout -b feat/your-feature-name
```

---

## 🎨 A Note on Design (Neo-Brutalism)

Rinse uses a highly specific **Neo-Brutalist** design language. If you are submitting UI changes or new components, please stick to the aesthetic:

* **Thick Borders:** `border-4 border-black` or `border-8 border-black`.
* **Heavy Shadows:** Hard, unblurred shadows using Tailwind brackets like `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`.
* **Bold Colors:** Use bright, unapologetic pastel colors (pinks, yellows, cyans) from the Tailwind palette.
* **No rounding:** Keep corners sharp (`rounded-none`).

---

## 🚀 Submitting a Pull Request (PR)

1. **Commit your changes:** Write a clear, concise commit message explaining what you did.
2. **Push to your fork:** `git push origin your-branch-name`.
3. **Open the PR:** Go to the original Rinse repository and click "Compare & pull request".
4. **Describe the change:** In your PR description, explain *why* you made the change and exactly *how* it works.
5. **Screenshots:** If your PR changes the UI, **please include before/after screenshots** in the PR description. It makes reviewing significantly faster!

Once you submit your PR, maintainers will review your code, provide feedback if needed, and merge it in.

Thank you for helping keep the PG laundry peace!
