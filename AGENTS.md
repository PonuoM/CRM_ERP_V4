# Repository Guidelines & Agentic Work Rules

**TARGET AUDIENCE:** AI Agents and Human Developers.
**PURPOSE:** Strict guidelines to ensure code maintainability, performance, and safe execution. Read and follow these rules before starting any task.

---

## 1. 🏗️ PROJECT STRUCTURE

### Frontend (React + TypeScript + Vite)
- **`/pages`**: Top-level views (e.g., `InventoryPage.tsx`). One file per major screen.
- **`/components`**: Reusable UI elements (`Button`, `Table`). Keep them decoupled from heavy business logic.
- **`/services`**: API fetching logic (e.g., `api.ts`). Keep UI separated from network requests.
- **`/types.ts`**: Centralized TypeScript interfaces for easy importing.
- **Path Alias**: `@` points to the project root (see `tsconfig.json` and `vite.config.ts`). Example: `import Sidebar from '@/components/Sidebar'`.
- A secondary `src/` mirrors some folders for legacy/experimental code. Prefer root-level folders for new work. Do not relocate files unless part of a planned refactor.

### Backend (PHP + MySQL)
- **`/api/index.php`**: The main API entry point and router. All frontend requests go here.
- **`/api/Services/`**: Complex business logic, external API integrations, and data processing.
- **`/api/migrations/`**: All database schema changes **MUST** be recorded here as `.sql` files.

---

## 2. 💻 CODING CONVENTIONS

### Frontend
- **Naming**: `PascalCase` for Components/Pages (`CustomerTable.tsx`). `camelCase` for variables/utilities (`loadInventory`).
- **State Management**: Extract complex logic into Custom Hooks. Use `useMemo` and `useCallback` to prevent unnecessary re-renders.
- **Styling**: Use **Tailwind CSS**. Avoid custom `.css` files unless absolutely necessary to maintain a unified design system.
- **Exports**: Default export for React components; use named exports for helpers/types.

### Backend
- **Security First**: **NEVER** concatenate SQL strings. **ALWAYS** use PDO Prepared Statements (`?` or `:name`) to prevent SQL injection.
- **Standardized Response**: All API responses MUST follow this exact JSON structure:
  ```json
  {
    "ok": true, // boolean
    "message": "Success or error description", // string
    "data": { ... } // object or array (optional)
  }
  ```
- **Error Handling**: Wrap DB operations and external API calls in `try-catch`. Do NOT allow silent failures.

---

## 3. 🚀 PERFORMANCE & OPTIMIZATION
- **Bulk Database Operations**: If inserting/updating >100 records, you **MUST** use `beginTransaction()` and `commit()` to minimize disk I/O overhead.
- **Lazy Loading**: Use pagination or virtualization for large frontend datasets. Do not load thousands of rows into the DOM at once.
- **Caching**: Implement file or memory caching for static or heavy data.
- **Data Freshness Indicators**: For data updated via Background Workers or Cron, **always display the last updated timestamp and sync source** (e.g., "Updated by Cron" vs "Updated Manually") in the UI to prevent user confusion.

---

## 4. 🌿 GIT & PULL REQUEST WORKFLOW
- For rules regarding commits and PRs, please refer to the Git Workflow guide. (Use `/git-workflow` or view `.agents/workflows/git-workflow.md`)

---

## 5. 🤖 CRITICAL RULES FOR AI AGENTS

**Rule 1: Terminal Freeze Prevention (Windows Environment) (⭐ CRITICAL)**
- **NEVER** use the `run_command` (terminal) tool to run scripts (like PHP) or gather information. The terminal pipe freezes on the user's Windows environment.
- **DO**: Always use native tools (`view_file`, `grep_search`, `list_dir`) or execute scripts via `read_url_content` pointing to the Localhost (e.g., `http://localhost/CRM_ERP_V4/...`).

**Rule 2: Critical Thinking & Best Practice Overrides (⭐ CRITICAL)**
- **THINK FIRST**: Before writing code, analyze if the user's request is the optimal approach.
- **OVERRIDE INFERIOR REQUESTS**: If the user asks for something technically flawed (e.g., *"Load all 100,000 users into the table"*), **DO NOT** blindly comply.
- **COUNTER-PROPOSE**: Stop and suggest the "Best Practice" instead (e.g., *"A better approach is server-side pagination to prevent browser freezing. Here is the plan..."*).
- **GRILL THE USER**: If requirements are vague, use the `/grill-me` approach to ask targeted questions until all dependencies and constraints are resolved.

**Rule 3: Mandatory Implementation Plans**
- For **New Systems** or **Significant Architectural Changes**, you **MUST** research, create an `implementation_plan.md`, and await user approval before modifying any code. Prevent cascading bugs by planning first.

**Rule 4: Security & Configuration Tips**
- **NEVER** hardcode API Keys, tokens, or passwords in the source code. Always read them from Environment Variables (e.g. `.env.local` which is git-ignored). Rotate `GEMINI_API_KEY` if exposed.

**Rule 5: Local Database Credentials (CRITICAL)**
- **NEVER** use the `primacom_bloguser` database user when running local scripts or executing CLI SQL commands. That user is for the production server.
- **ALWAYS** use `root` with password `12345678` when connecting to the local database via terminal or custom scripts.

**Rule 6: Code Scoping**
- Modify only what is necessary. Do not refactor massive parts of the codebase without explicit permission.

**Rule 7: Single-Use Scripts (Scratch Folder)**
- **NEVER** litter the root directory or `/api` folder with one-off scripts (e.g., test scripts, manual data migration scripts).
- **ALWAYS** create them in a temporary `/scratch` folder (or the artifact scratch directory), execute them, and **delete them immediately** after use to keep the repository clean.

**Rule 8: Mandatory Migrations (⭐ CRITICAL)**
- **ALWAYS** create a migration file in `/api/migrations/` (e.g., `001_add_new_column.sql`) whenever you add a column, modify a table, or change the database schema.
- **NEVER** just run an `ALTER TABLE` command in the terminal without also creating the corresponding `.sql` migration file, as this breaks database versioning for other developers.

**Rule 9: UI Components over Native Alerts**
- **NEVER** use `window.alert`, `window.confirm`, or `window.prompt` for user interactions.
- **ALWAYS** use custom UI components like `Modal`, `Toast`, or `Alert` provided by the system or design library to maintain a consistent and professional user experience.


