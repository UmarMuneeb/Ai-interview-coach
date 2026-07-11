
## Date: 2026-07-05

### Phase 10: Review Sidebar (Top 20 Incorrect Questions)
- **Backend**: Added getQuestionsForReview to QuestionsService that fetches the last 20 questions the user answered with an 'incorrect', 'partial', 'misunderstood', or 'evasive' classification. Added a GET /review endpoint in QuestionsController.
- **Frontend**: Refactored pps/web/app/dashboard/page.tsx from a single column grid to a 2-column layout (3fr/1fr) for large screens. Added a right <aside> sidebar that fetches and lists the review questions fetched from the new API endpoint, displaying the classification badge, date, topic, and snippet of the question prompt.
- **Testing**: Built both pps/api and pps/web successfully to verify type safety and layout.

## Date: 2026-07-12

### Phase 11: UI Polish and De-Slopification
Full UI audit performed across all 5 frontend files using ui-tester, emil-design-eng, and ui-ux-pro-max skills. 12 issues found and fixed:

**globals.css**: Updated all transition tokens to Emil Kowalski standard cubic-bezier(0.23,1,0.32,1). Added missing btn-outline class (was causing unstyled buttons in interview page). Added @keyframes bounce (missing, used by voice visualizer). Added @keyframes float/float-reverse for login page blobs. Added .skeleton utility class for shimmer loading. Wrapped ALL :hover rules in @media (hover:hover) and (pointer:fine) to prevent touch-device sticky states. Reduced stagger animation delays from 100-400ms to 40-160ms per Emil standard.

**AppLayout.tsx**: Replaced emoji logo (??) with SVG circuit mark. Renamed app to InterviewIQ. Added logout button to navbar that clears token and redirects to /login.

**login/page.tsx**: Replaced emoji logo with SVG brand mark. Updated subtitle copy from generic AI slop to punchy human text. Added useEffect to auto-focus email field on mode switch. Added floating animation to ambient background blobs.

**dashboard/page.tsx**: Fixed page title from 'Analytics Dashboard' to 'Practice Dashboard'. Fixed subtitle copy. Removed Quick Start emoji from section header. Improved field selection buttons with hover transitions. Updated stats cards with icons and contextual sub-labels. Added skeleton loading placeholders. Added proper empty state for new users with illustration and CTA. Added hover lift effect to Review Sidebar cards. Updated empty review message to human copy.

**interview/[sessionId]/page.tsx**: Humanized ready screen copy. Replaced emoji mic (??) with SVG microphone icon. Replaced emoji status strings with CSS-animated bars. Added short-answer warning hint when transcript < 50 chars. Added aria-label to mic button.
