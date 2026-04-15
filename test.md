# Automated Testing Guide

This guide explains how to effectively and quickly test the entire application before pushing code to the repository.

## The All-in-One Command

You can run the full suite of validations (Linting, Unit tests, and End-to-End tests) with a single command. Run this command at the root of your project:

```bash
npm run test:all
```

### What this command actually does:
The `npm run test:all` script acts as a pipeline that runs three checks sequentially. It will immediately fail and stop if any step encounters an error.

1. **Linting (`npm run lint`)**
   - Validates code syntax and type correctness using the TypeScript Compiler (`tsc --noEmit`).
   - Ensures there are no structural or type-related bugs across the `.ts` and `.tsx` files.
   
2. **Unit Tests (`npm run test -- --run`)**
   - Executes all fast logic tests using [Vitest](https://vitest.dev/).
   - The `--run` flag guarantees it runs one time until completion instead of hanging in interactive "watch" mode.
   
3. **End-to-End Tests (`npm run test:e2e`)**
   - Runs full browser simulation testing via [Playwright](https://playwright.dev/).
   - Automatically tests complete user journeys (like logging in, routing, and creating leads).

## Manual Breakdown (If a test fails)

If the all-in-one script fails, you can isolate the error and re-run only the specific step that requires fixing:

*   **To check types and linting only:**
    ```bash
    npm run lint
    ```
*   **To run unit tests continuously (Watch Mode) while fixing them:**
    ```bash
    npm run test
    ```
*   **To debug End-to-End UI tests natively with the Playwright UI:**
    ```bash
    npx playwright test --ui
    ```

## Adding Pre-Push Automation (Optional)
If you want to guarantee this runs automatically *before* every `git push` so you never accidentally push failing code, you can use a git hook.

1. Install husky: `npm install --save-dev husky`
2. Initialize it: `npx husky init`
3. Add the pre-push script: `echo "npm run test:all" > .husky/pre-push`
