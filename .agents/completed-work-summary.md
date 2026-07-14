
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

---

## Phase 12: Voice Interview Loop Correctness
Completed: 2026-07-14

### What was broken (root causes)
Three distinct bugs caused the 30-minute drill loop and missing DB saves:

1. **Infinite drill loop** — conversation.service.ts used Math.min(questionIndex + 1, length - 1) which clamped at the last question forever. The system prompt also told Alex to "ask a follow-up after EVERY answer" with no hard exit rule.
2. **Voice answers never saved to DB** — VoiceGateway.handleVoiceTurn() only called conversationService.processTurn(). It never called sessionsService.submitAnswer(), so all answers were lost on socket disconnect.
3. **Same first question every session** — No session-specific seen-ID exclusion before session start.

### What was fixed

**pps/api/src/voice/conversation.service.ts** (rewrite)
- Added drillUsed: boolean, nsweredQuestionIds: string[], interviewComplete: boolean to ConversationState.
- processTurn() now returns { text, shouldAdvance, interviewComplete } instead of a plain string.
- Drill policy: first wrong answer ? set drillUsed = true, do NOT advance. Second wrong (or correct) ? advance. Reset drillUsed on every question advance.
- When questionIndex >= allQuestions.length, set phase = 'wrap-up' and interviewComplete = true (no more clamping).
- System prompt updated with strict rule 5: 1-drill-max + mandatory "Okay, let's move on" after drill.
- Added {{DRILL_USED}} placeholder to prompt so Alex is always aware of drill state.
- New public helpers: getAnsweredQuestionIds(), isInterviewComplete(), pushNextQuestion().

**pps/api/src/voice/voice.gateway.ts** (rewrite)
- Added GatewaySocketState map (currentQuestion, sessionId, userId, ield) per socket.
- Injected SessionsService and QuestionsService.
- handleVoiceTurn() now: (1) calls sessionsService.submitAnswer() to persist answer + classify; (2) emits nswer_classified event to client; (3) passes wasCorrect to conversationService.processTurn(); (4) on shouldAdvance, emits question_advanced with nextQuestion from DB (or fetches fresh from questionsService.getNextQuestion() if submitAnswer didn't return one).

**pps/api/src/voice/voice.module.ts**
- Added SessionsModule and QuestionsModule to imports so gateway can inject their services.

**pps/web/hooks/useVoiceInterviewer.ts**
- Extended QuestionBrief interface with id and subtopic fields.
- Added onQuestionAdvanced and onAnswerClassified optional callback params.
- Registers question_advanced and nswer_classified socket event listeners.
- Exported QuestionAdvancedPayload and AnswerClassifiedPayload types.

**pps/web/app/interview/[sessionId]/page.tsx**
- Added handleQuestionAdvanced and handleAnswerClassified stable useCallback handlers.
- Wired both callbacks into useVoiceInterviewer.
- handleQuestionAdvanced updates question state in-place when the gateway emits question_advanced.
- Fixed two llQuestions.map() calls to include id and subtopic fields (TypeScript build error).
- Added interviewComplete state variable for session wrap-up signal.

### Tests
- pps/api/src/voice/conversation.service.spec.ts — 12 tests, all passing.
- Covers: greeting, phase transition, drill policy (first wrong / second wrong / correct), question exhaustion/interviewComplete, answeredQuestionIds accumulation, pushNextQuestion, cleanup.

### Build verification
- pps/api: 
px nest build — ? clean
- pps/web: 
pm run build — ? clean
