# 4-Layer React Architecture Guide

## Overview

This project follows a **4-Layer React Architecture** pattern that separates concerns and makes the codebase more maintainable, testable, and scalable.

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer                               │
│              (InterviewSetupUI.jsx)                         │
│        Pure Components - No State, No Side Effects          │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Hook Layer                               │
│              (useInterviewSetup.js)                         │
│         State Management & Business Logic                   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   State Layer                               │
│            (Context API / Redux - Optional)                 │
│         Global State & Cross-Component Communication        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                │
│              (interview.api.js)                             │
│          External API Communication & Data Transformation   │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: UI Layer (Presentation)

**File**: `features/interview/components/InterviewSetupUI.jsx`

### Purpose
- Render the user interface
- Display data via props
- Call handler functions on user interactions
- No state management
- No side effects

### Key Characteristics
✓ Pure component (same props = same output)
✓ Presentational only
✓ All behavior via props
✓ Easy to test
✓ Reusable in different contexts

### Props Received
```javascript
{
  jobDescription,           // string
  onJobDescriptionChange,   // function
  selfDescription,          // string
  onSelfDescriptionChange,  // function
  resume,                   // File | null
  onResumeChange,           // function
  onGenerate,              // function
  isLoading,               // boolean
  errors                   // object
}
```

### Example Usage
```jsx
<InterviewSetupUI
  jobDescription={state.jobDescription}
  onJobDescriptionChange={handlers.onJobDescriptionChange}
  // ... other props
  errors={errors}
/>
```

---

## Layer 2: Hook Layer (Business Logic)

**File**: `features/interview/hooks/useInterviewSetup.js`

### Purpose
- Manage component state
- Implement validation logic
- Handle side effects
- Orchestrate data flow
- Prepare data for API calls

### Key Characteristics
✓ Custom React hook
✓ No UI rendering
✓ Pure logic functions
✓ Reusable across components
✓ Easy to unit test

### What It Does
1. **State Management**
   - Manages form field states
   - Tracks loading state
   - Tracks validation errors

2. **Validation**
   - Validates job description length
   - Validates self description length
   - Validates file type (PDF/DOCX)
   - Validates file size (max 5MB)
   - Requires resume OR self-description

3. **Error Handling**
   - Collects validation errors
   - Clears errors on user input
   - Formats error messages

### Returns
```javascript
{
  state: {
    jobDescription,      // string
    selfDescription,     // string
    resume,              // File | null
    isLoading            // boolean
  },
  handlers: {
    onJobDescriptionChange,    // function
    onSelfDescriptionChange,   // function
    onResumeChange,            // function
    onGenerate                 // function
  },
  errors: {
    jobDescription,      // string | undefined
    selfDescription,     // string | undefined
    resume,              // string | undefined
    submit               // string | undefined
  },
  reset                  // function
}
```

### Example Usage
```jsx
const { state, handlers, errors, reset } = useInterviewSetup(async (formData) => {
  // Called when generate button is clicked
  // This is where you call the API layer
  await submitInterviewSetup(formData);
});
```

---

## Layer 3: State Layer (Global State)

**Status**: Optional - Not implemented yet

### Purpose
- Share state across multiple components
- Persist data across page navigations
- Manage application-wide state
- Cache API responses

### When to Use
- Data needed by multiple components
- Persisting form data across pages
- Caching interview results
- User session management

### Implementation Options
1. **Context API** (Built-in, simple)
   - Good for small to medium apps
   - Less boilerplate than Redux

2. **Redux** (Powerful, scalable)
   - Good for large apps
   - Predictable state updates
   - DevTools support

### Example (Future)
```jsx
// Provider setup in App.jsx
<InterviewContextProvider>
  <App />
</InterviewContextProvider>

// Usage in components
const { interviewData } = useInterviewContext();
```

---

## Layer 4: API Layer (External Communication)

**File**: `features/interview/services/interview.api.js`

**Status**: To be created

### Purpose
- Handle all HTTP requests
- Transform request/response data
- Handle errors
- Manage loading states
- Cache responses (optional)

### Key Responsibilities
1. **API Communication**
   - POST to /api/interview/setup
   - Handle file uploads (FormData)
   - Send job description and self-description

2. **Data Transformation**
   - Format request payload
   - Parse response
   - Extract relevant data

3. **Error Handling**
   - Convert API errors to user-friendly messages
   - Log errors for debugging
   - Retry failed requests (optional)

### Example (Future)
```javascript
// interview.api.js
export const submitInterviewSetup = async (formData) => {
  const data = new FormData();
  data.append('jobDescription', formData.jobDescription);
  data.append('selfDescription', formData.selfDescription);
  if (formData.resume) {
    data.append('resume', formData.resume);
  }

  const response = await fetch('/api/interview/setup', {
    method: 'POST',
    body: data
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
};
```

---

## Complete Flow Example

```
User Input (Typing in textarea)
         ↓
UI Component calls handler
         ↓
Hook validates and updates state
         ↓
Hook returns new state/errors
         ↓
UI re-renders with new props
         ↓
User clicks "Generate"
         ↓
Hook validates entire form
         ↓
Hook sets isLoading = true
         ↓
Hook calls onSubmit callback (API Layer)
         ↓
API Layer makes HTTP request
         ↓
API Layer returns response or error
         ↓
Hook sets isLoading = false
         ↓
Hook updates state/errors if needed
         ↓
Component navigates to next page
```

---

## Directory Structure

```
frontend/src/features/interview/
├── components/
│   ├── InterviewSetupUI.jsx          ← UI Layer (Pure Component)
│   └── protected.jsx
├── hooks/
│   └── useInterviewSetup.js          ← Hook Layer (Business Logic)
├── pages/
│   ├── home.jsx                      ← Current implementation (will be replaced)
│   ├── interview.jsx
│   └── InterviewSetupContainer.jsx   ← Container connecting layers
├── services/
│   ├── interview.api.js              ← API Layer (To be created)
│   └── interview.api.js
└── style/
    ├── interview-setup-ui.scss       ← Styles for UI Layer
    ├── interview.scss
    └── home.scss
```

---

## Best Practices

### Do's ✓
- Keep UI components pure and focused
- Use custom hooks for business logic
- Validate data in the Hook layer
- Use the API layer for all external communication
- Pass props down, call handlers up
- Use TypeScript (optional but recommended)
- Write unit tests for hooks
- Write integration tests for containers

### Don'ts ✗
- Don't call APIs from UI components
- Don't manage complex state in UI components
- Don't put business logic in containers
- Don't create dependencies between UI components
- Don't hardcode API endpoints in components
- Don't expose internal state structure in props

---

## Testing Strategy

### UI Component Tests
```javascript
// InterviewSetupUI.test.jsx
describe('InterviewSetupUI', () => {
  it('renders all form fields', () => {
    render(<InterviewSetupUI {...props} />);
    expect(screen.getByPlaceholderText(/job description/i)).toBeInTheDocument();
  });

  it('calls onGenerate when button is clicked', () => {
    const onGenerate = jest.fn();
    render(<InterviewSetupUI onGenerate={onGenerate} {...props} />);
    click(screen.getByText(/generate/i));
    expect(onGenerate).toHaveBeenCalled();
  });
});
```

### Hook Tests
```javascript
// useInterviewSetup.test.js
describe('useInterviewSetup', () => {
  it('validates job description is required', () => {
    const { result } = renderHook(() => useInterviewSetup());
    act(() => {
      result.current.handlers.onGenerate();
    });
    expect(result.current.errors.jobDescription).toBeDefined();
  });

  it('validates file type', () => {
    const { result } = renderHook(() => useInterviewSetup());
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    act(() => {
      result.current.handlers.onResumeChange(invalidFile);
    });
    expect(result.current.errors.resume).toBeDefined();
  });
});
```

---

## Migration Path

### Phase 1: UI Layer ✓ DONE
- Created pure UI component
- Implemented responsive styles
- Matches design image

### Phase 2: Hook Layer ✓ DONE
- Created useInterviewSetup hook
- Implemented validation logic
- Added error handling

### Phase 3: State Layer (To do)
- Create Context/Redux if needed
- Share interview data across app
- Persist form state

### Phase 4: API Layer (To do)
- Create interview.api.js
- Implement submitInterviewSetup()
- Add error handling and loading states

---

## Common Questions

**Q: Why separate UI and business logic?**
A: Easier testing, reusability, and maintenance. UI can be swapped without changing logic.

**Q: When do I need the State Layer?**
A: When multiple components need the same data, or when data needs to persist across navigation.

**Q: Can I use this pattern with TypeScript?**
A: Absolutely! Add `.ts` extensions and define proper types for better type safety.

**Q: How do I handle API errors?**
A: The Hook layer validates and collects errors. The API layer throws errors which the Hook catches and formats for the UI.

**Q: What if I need async operations in the Hook?**
A: Use `useEffect` or `useCallback` to manage async operations. The hook handles it before calling the API layer.
