# FightWeek App - Refactored Structure

## 📁 Folder Organization (Phase 1 Complete)

This document explains the new folder structure established in Phase 1 refactoring.

### `/src/config` - Application Constants & Setup
**Files:**
- `constants.ts` - All app-wide constants (DAYS, CATEGORIES, GLOBAL_TEMPLATES, USER_MAPPING, FIGHTERS)
- `firebase.ts` - Firebase initialization (auth, db instances)

**Why separate?** 
- Configuration changes don't require code logic changes
- Easy to customize for different environments (test, prod, etc.)

### `/src/lib` - Low-Level Utilities & Services
Currently empty (planned for Phase 2):
- Firebase Firestore operations
- API client setup
- Third-party integrations

**Why separate?**
- Business logic stays in hooks/components
- Library code is reusable and testable

### `/src/utils` - Helper Functions
**Files:**
- `dateUtils.ts` - Week calculations, date formatting
  - `getISOWeek()` - Current week number
  - `getDateForWeekDay()` - Get date for specific day in week
  - `getWeekDateMap()` - Map all days to dates
  - `formatCancellationTime()` - Format cancellation display
  - `addMinutes()` - Time arithmetic

- `csvUtils.ts` - CSV parsing and generation
  - `parseCSV()` - Auto-detect delimiter, parse to objects
  - `generateCSV()` - Export backlog to CSV
  - `generateFeedbackCSV()` - Export feedback to CSV

- `deviceUtils.ts` - Device detection
  - `checkInAppBrowser()` - Detect Facebook/Instagram browser
  - `isMobileDevice()` - Detect mobile/tablet
  - `getDeviceInfo()` - Get user agent for logging

**Why separate?**
- Pure functions, easy to test
- Reusable across components
- No dependencies on React or Firebase

### `/src/hooks` - Custom React Hooks
**Currently planned (not yet implemented):**
- `useAuth.ts` - Authentication state management
- `useScheduleData.ts` - Fetch and manage schedule data from Firestore
- `useAdminBacklog.ts` - Admin dashboard state

**Why custom hooks?**
- Isolate complex logic from components
- Reusable across multiple components
- Easier to test
- Cleaner component code

### `/src/types` - TypeScript Type Definitions
**Files:**
- `common.ts` - Shared types (User, Session, Feedback, Backlog items)
- `workflow.ts` - Weekly planning workflow states (Future Phase 2)

**Why separate?**
- Types are used by many files
- Documentation of data structures
- Prevents type duplication

### `/src/components` - React Components (Phase 2)
**Currently not extracted (will be done in Phase 2):**
- LoginScreen
- PersonalSchedule
- TeamSchedule
- AdminDashboard
- Modals (FeedbackModal, ConfirmModal, SessionModal)

**Strategy:**
- Each component gets its own file
- Props are typed with interfaces
- Hooks handle state/data logic

---

## 🔄 Migration Path: App.jsx → App.tsx + Components

### Current State
- Single 2,158 line `App.jsx` file
- All logic inline
- All imports in one file
- Monolithic state management

### Phase 1 (✅ Complete)
- ✅ Extracted constants → `config/constants.ts`
- ✅ Extracted utilities → `utils/`
- ✅ Extracted Firebase setup → `config/firebase.ts`
- ✅ Created type definitions → `types/`
- ✅ Added TypeScript support (tsconfig.json)
- **Status:** Ready to update App.jsx imports

### Phase 2 (Next)
- [ ] Update App.jsx → App.tsx imports
- [ ] Create custom hooks (useAuth, useScheduleData, etc.)
- [ ] Extract modal components
- [ ] Extract main view components
- [ ] Test thoroughly

### Phase 3 (Later)
- [ ] Consolidate state management (Context or Zustand)
- [ ] Add tests for critical paths
- [ ] Performance optimization

---

## 📝 How to Use These New Files

### Importing from Config
```typescript
import { DAYS, CATEGORIES, GLOBAL_TEMPLATES, USER_MAPPING } from '@config/constants';
import { auth, db } from '@config/firebase';
```

### Importing Utils
```typescript
import { getISOWeek, getDateForWeekDay, formatCancellationTime } from '@utils/dateUtils';
import { parseCSV, generateCSV } from '@utils/csvUtils';
import { checkInAppBrowser, isMobileDevice } from '@utils/deviceUtils';
```

### Using Types
```typescript
import { UserProfile, TrainingSession, WeeklyPlan } from '@types/common';
import { WeeklyPlanStatus, WeeklyPlanWorkflow } from '@types/workflow';
```

---

## ✅ Next Steps

1. **Install dependencies:** `npm install` (TypeScript was added to package.json)
2. **Update App.jsx imports:** Change from inline functions to new import paths
3. **Rename App.jsx → App.tsx:** Enable TypeScript benefits
4. **Test:** Run `npm run dev` and verify all features work
5. **Continue Phase 2:** Extract components and hooks

---

## 🐛 What was fixed by this refactoring?

Nothing yet - **this is structural only**. The behavior is identical.

**But this ENABLES fixes for:**
- ✅ Black screen in feedback inbox (Phase 2)
- ✅ Horizontal overflow in team view (Phase 2)
- ✅ Features breaking corners (TypeScript prevents this going forward)

---

## 📚 Resources

- **Project Home:** `/workspaces/fightweek-app`
- **Type Definitions:** `src/types/`
- **Constants:** `src/config/constants.ts`
- **Firebase Setup:** `src/config/firebase.ts`
- **Utilities:** `src/utils/`

---

*Last Updated: February 13, 2026*
