# Contributing Guidelines

## Code Style

- **Naming**:
  - Files: `kebab-case.tsx` (e.g., `user-profile.tsx`)
  - Components: `PascalCase` (e.g., `UserProfile`)
  - Functions/Vars: `camelCase` (e.g., `handleSubmit`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)

- **Formatting**:
  - We use Prettier and ESLint.
  - Run `npm run lint` before committing.

- **Type Safety**:
  - No `any`. Use specific interfaces/types.
  - Define types in `types.ts` or component-specific definition files.

## Git Flow

1. Create a feature branch: `git checkout -b feature/my-new-feature`
2. Commit changes: `git commit -m "feat: add new feature"`
   - Use conventional commits: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`.
3. Push to branch: `git push origin feature/my-new-feature`
4. Open a Pull Request.

## Component Guidelines

- **Props**: Use interfaces for props.
- **Hooks**: Extract complex logic into custom hooks (`useCustomHook.ts`).
- **Performance**: Use `React.memo`, `useMemo`, and `useCallback` for expensive operations.
- **Accessibility**: Ensure all interactive elements have `aria-label` or visible labels. Support keyboard navigation.

## File Organization

- **Page specific components**: Keep them in the same folder as the page if not reused.
- **Shared components**: Place in `src/components/shared` or specific domain folder (e.g., `src/components/sales`).
- **UI primitives**: Place in `src/components/ui`.
