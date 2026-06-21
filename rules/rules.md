

# 🛠️ Rinse Engineering & Coding Rules

This document defines the strict coding standards, architectural patterns, and design constraints for the Rinse repository. All contributors and AI coding assistants must adhere to these rules to maintain a clean, performant, and visually consistent codebase.

## 1. Core Tech Stack Strictness

* **Frontend:** React 18 (Vite build). Use functional components and React Hooks exclusively. No class components.
* **Styling:** Tailwind CSS only. Do not use external CSS files, CSS modules, or inline `<style>` tags unless absolutely necessary for dynamic calculations.
* **Backend Integration:** Supabase (`@supabase/supabase-js`).
* **Mobile Wrap:** Capacitor. Ensure all UI components remain responsive and touch-friendly for native mobile rendering.

## 2. Component Architecture & Naming
| Case Type | Example | Where to Use It in Rinse |
| :--- | :--- | :--- |
| **PascalCase** | `ResidentDashboard.jsx`<br>`AuthModal.tsx` | **React Components:** Every React component file and the function name itself must use this. |
| **camelCase** | `useWashScore.js`<br>`calculatePenalty()`<br>`isApproved` | **Logic & Variables:** Custom hooks, utility functions, state variables, and general JavaScript logic. |
| **kebab-case** | `setup-guide.md`<br>`components/ui/`<br>`/auth/login` | **Files & Folders:** Non-component file names, directory folder names, and URL routing paths. |
| **snake_case** | `wash_score`<br>`pg_id`<br>`join_requests` | **Database:** Supabase/PostgreSQL table names and column headers. Keep database strict and lowercase. |
| **UPPER_SNAKE_CASE** | `VITE_SUPABASE_URL`<br>`MAX_GHOST_MINUTES` | **Constants:** Environment variables (`.env` files) and globally hardcoded configuration values. |

## 3. The Neo-Brutalist Design System (Mandatory)

Rinse utilizes a strict Neo-Brutalist aesthetic. Do not introduce modern, soft UI paradigms.

* **Borders:** Must be thick and absolute. Use `border-4 border-black` or `border-8 border-black`.
* **Shadows:** NO blur. Shadows must be solid offsets. Use Tailwind arbitrary values: `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`.
* **Corners:** Keep them sharp. Do not use `rounded-md` or `rounded-lg`. Elements must be blocky (`rounded-none`).
* **Colors:** Stick to high-contrast, unapologetic pastel backgrounds (`bg-yellow-300`, `bg-pink-300`, `bg-cyan-300`, `bg-green-300`) contrasted with heavy black text and borders.
* **Typography:** Keep text large, uppercase for headers, and heavily weighted (`font-black`, `font-bold`).

## 4. State Management & Data Fetching

* Use React Context for global state only when necessary (e.g., `AuthContext.jsx` for the current user session).
* For standard data fetching, query Supabase directly inside `useEffect` blocks or custom hooks.
* Always handle loading states and error states explicitly. The UI should never break silently if a Supabase query fails.

## 5. Database & Security Rules

* Never expose the Supabase `service_role` key in the frontend. Only use the `anon` key.
* Rely on Supabase Row Level Security (RLS) policies to protect data, not just frontend conditional rendering.
* Database queries should strictly select only the columns needed (e.g., `.select('id, full_name, wash_score')` instead of `.select('*')`) to minimize payload size.

## 6. Code Quality & Cleanliness

* Remove all `console.log()` statements before opening a Pull Request.
* Ensure there are no unused imports or variables.
* Write clear, concise comments only for complex logic (like the Lazy Sweeper timing calculations). Do not over-comment obvious React boilerplate.

## 7. Human-Centric Communication & PRs

* Write Pull Request descriptions, documentation, and commit messages using simple, human language.
* Strictly avoid overly administrative, bloated, or text that feels "AI-ish" (e.g., "In today's fast-paced digital landscape...").
* Explain what the problem was and how you solved it directly.

## 8. AI-Assisted "Vibe Coding" Boundaries

* If you are accelerating frontend or backend development using AI tools like Cursor, it is your responsibility to police the output.
* Do not let the assistant hallucinate standard UI libraries, soft shadows, or rounded corners. The AI must be explicitly instructed to adhere to the Neo-Brutalist constraints defined in Rule 3.
* Ensure generated documentation and code comments remain concise.

## 9. Algorithm Isolation & Logic Mastery

* The gamification math (calculating Wash Scores, managing the 15-minute Lazy Sweeper countdown) must be completely decoupled from the React UI components.

* Focus on mastering the core logic by writing these features as pure, isolated functions. This makes the strict booking rules infinitely easier to test and prevents UI re-renders from breaking the penalty math.