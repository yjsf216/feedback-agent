# Frontend design specification

## Product goals and users

### Public Web and Flutter SDK

- **Goal:** let a user describe a question or pain point immediately, receive a grounded answer, and leave useful feedback without feeling interviewed.
- **Primary scene:** a user opens an app-specific feedback link or launches the embedded Flutter panel after encountering a problem.
- **Primary action:** start or continue the conversation. Resolution feedback is secondary and appears only after an answer.
- **Information priority:** app identity and trust → current conversation → suggested prompts → sources and confidence → resolution state → privacy/contact details.

### Administrator console

- **Goal:** turn conversations into an actionable queue and validated product requirements.
- **Primary scene:** a product owner selects an app, reviews unresolved conversations and AI-created requirement drafts, then confirms or rejects them.
- **Primary action:** resolve the highest-priority open item. Configuration and model details remain secondary.
- **Information priority:** global app context → urgent/open workload → trends → evidence → settings.

## Information architecture

Public routes:

1. `/` — platform promise, feature flow, privacy summary, and demo entry.
2. `/feedback/[appSlug]` — app-branded conversation and resolution flow.
3. `/auth/*` — email and WeChat callbacks with a clear return to the conversation.

Admin navigation:

1. Overview
2. Conversations
3. Human review queue
4. Feedback items
5. Requirements
6. Knowledge base
7. Reports
8. Applications
9. System settings

The global app selector sits in the admin header. `All apps` is an aggregate context; app-specific pages require an explicit app selection. `Add app` launches a guided setup flow and selects the new app on completion.

## Visual direction

The public experience should feel like a calm signal room: warm neutral surfaces, strong cobalt actions, a sharp coral escalation accent, and restrained teal success feedback. It should look trustworthy and observant rather than playful or futuristic.

- Desktop uses an asymmetric 5/7 split: product context and trust on the left, the active conversation on the right.
- Mobile gives the conversation the first viewport and pins the composer above the safe area.
- Cards can overlap the background rail slightly; avoid a symmetric card grid.
- Admin retains pure-admin's interaction patterns but removes demo density and reorganizes screens around evidence and decisions.

## Typography

- Display and numeric emphasis: self-hosted **Manrope**, 600–750 weight.
- Chinese and long-form body: self-hosted **Noto Sans SC**, 400–600 weight.
- Public display title: 48/54 desktop, 34/40 mobile.
- Page title: 30/38; section title: 20/28; body: 16/26; supporting text: 14/21; button: 15/20 at 650.
- Flutter maps the same hierarchy to local assets or `PingFang SC`/platform fallback without downloading fonts at runtime.

## Semantic color system

Tokens are defined once and mapped to app branding; raw colors are not scattered through components.

```css
:root {
  --background: oklch(0.975 0.012 84);
  --foreground: oklch(0.235 0.035 253);
  --card: oklch(0.995 0.006 84);
  --muted: oklch(0.945 0.014 247);
  --muted-foreground: oklch(0.49 0.035 252);
  --primary: oklch(0.56 0.17 251);
  --primary-foreground: oklch(0.985 0.005 250);
  --accent: oklch(0.67 0.19 37);
  --success: oklch(0.61 0.12 169);
  --warning: oklch(0.72 0.15 78);
  --error: oklch(0.59 0.21 28);
  --border: oklch(0.88 0.02 251);
}
```

Dark mode uses a blue-warm charcoal background rather than pure black. App-provided brand colors are validated for contrast before use.

## Motion and feedback

- Press and focus response: 100–140 ms.
- Message insertion and panel transitions: 180–220 ms with no more than 8 px movement.
- Sheets and dialogs: 220–280 ms using system-like easing.
- Streaming uses a quiet caret and text growth, never a looping decorative animation.
- Reduced-motion mode removes transforms and retains opacity/state changes.

## Required component states

- App bootstrap: loading, unavailable, disabled, and misconfigured.
- Authentication: anonymous, signing in, expired token, callback failure, and account binding conflict.
- Conversation: empty, suggested prompts, sending, streaming, stopped, retryable failure, rate-limited, resolved, unresolved, and queued for review.
- Knowledge source: queued, parsing, embedding, ready, failed, disabled, and reindexing.
- Requirement: AI draft, approved, rejected, planned, in progress, and completed.
- Every error keeps user input and offers a concrete recovery action.

## Delivery review

- **Audit:** confirm one primary action, correct app context, logical reading order, complete empty/loading/error paths, and no cross-app ambiguity.
- **Polish:** verify 8 px spacing rhythm, consistent radii, icon stroke weight, focus rings, safe areas, and meaningful source presentation.
- **Typography:** test Chinese/English switching, long app names, 200% browser zoom, and maximum Flutter text scaling.
- **Animate:** verify response within 100 ms, no delayed critical state, and full reduced-motion support.
- Validate public and admin surfaces at 360, 768, 1280, and 1440 px in light and dark themes.
