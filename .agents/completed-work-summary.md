
## Date: 2026-07-05

### Phase 10: Review Sidebar (Top 20 Incorrect Questions)
- **Backend**: Added getQuestionsForReview to QuestionsService that fetches the last 20 questions the user answered with an 'incorrect', 'partial', 'misunderstood', or 'evasive' classification. Added a GET /review endpoint in QuestionsController.
- **Frontend**: Refactored pps/web/app/dashboard/page.tsx from a single column grid to a 2-column layout (3fr/1fr) for large screens. Added a right <aside> sidebar that fetches and lists the review questions fetched from the new API endpoint, displaying the classification badge, date, topic, and snippet of the question prompt.
- **Testing**: Built both pps/api and pps/web successfully to verify type safety and layout.
