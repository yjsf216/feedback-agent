# Feedback Agent Flutter SDK

Reusable Flutter API client and chat UI for the Feedback Agent platform. It
supports guest, email, and host-app identities; rotating access tokens; SSE
answers; cited knowledge; resolution feedback; and responsive full-page or
launcher experiences.

The SDK never accepts or stores an application secret. A host app that already
has users must perform the signed token exchange on its own trusted backend.

## Add the package

Until a registry release is ready, use the Git repository directly:

```yaml
dependencies:
  feedback_agent_flutter:
    git:
      url: https://github.com/yjsf216/feedback-agent.git
      path: packages/flutter_sdk
```

For a local checkout next to your host Flutter app, use a path dependency:

During monorepo development, use a path dependency:

```yaml
dependencies:
  feedback_agent_flutter:
    path: ../feedback-agent/packages/flutter_sdk
```

Create one client and controller for the lifetime of the host screen:

```dart
late final FeedbackChatController feedbackController;

@override
void initState() {
  super.initState();
  final client = FeedbackAgentClient(
    baseUri: Uri.parse('https://feedback-api.example.com'),
    appSlug: 'my-product',
  );
  feedbackController = FeedbackChatController(gateway: client);
}

@override
void dispose() {
  feedbackController.dispose();
  super.dispose();
}
```

`FeedbackChatController` owns and disposes its gateway by default. Set
`disposeGateway: false` only when sharing a gateway outside the controller.

## Choose an integration surface

Use a complete route:

```dart
Navigator.of(context).push(
  MaterialPageRoute(
    builder: (_) => FeedbackChatPage(controller: feedbackController),
  ),
);
```

Use a launcher on an existing page:

```dart
Scaffold(
  body: const ProductHome(),
  floatingActionButton: FeedbackChatLauncher(
    controller: feedbackController,
  ),
);
```

Or place `FeedbackChatView` in a panel and build a custom UI directly from
`FeedbackChatController.messages`.

## Identity modes

- Guest access is created lazily on the first message when enabled for the app.
- Email login and registration use the SDK's built-in dialog when enabled.
- Existing app SSO uses `authenticationHandler`. Your backend signs and calls
  `POST /v1/auth/exchange`; the Flutter app receives only the returned tokens.

```dart
FeedbackChatPage(
  controller: feedbackController,
  authenticationHandler: (context, config) async {
    final json = await myBackend.fetchFeedbackSession(config.id);
    return FeedbackAuthSession.fromJson(
      json,
      identityKind: FeedbackIdentityKind.host,
    );
  },
)
```

Never ship the Feedback Agent credential, signing key, or model key in a
Flutter binary. Token exchange signatures belong on a trusted server.

## Knowledge links and theming

The platform's configured primary color is applied automatically. Override it
with `FeedbackChatTheme`, and handle cited sources in the host app:

```dart
FeedbackChatView(
  controller: feedbackController,
  onSourceTap: (source) => openUrl(source.url),
)
```

## Local development

The example accepts compile-time configuration:

```sh
fvm flutter run -d chrome \
  --dart-define=FEEDBACK_API_URL=http://localhost:4100 \
  --dart-define=FEEDBACK_APP_SLUG=demo
```

- Android Emulator uses `http://10.0.2.2:4100` by default.
- iOS Simulator and Flutter Web use `http://localhost:4100` by default.
- Add the Flutter Web origin to the API's `CORS_ORIGINS` setting.
- Local HTTP is enabled only in the example's Android debug manifest. Use HTTPS
  in production; iOS also expects HTTPS unless the host explicitly configures
  a development-only ATS exception.

`flutter_secure_storage` persists sessions. On Web, deploy over HTTPS and treat
browser storage according to the host site's security policy; no client-side
web storage can protect an application secret, which is why secrets are never
part of this SDK.

## Verify

```sh
fvm flutter analyze
fvm flutter test
cd example && fvm flutter build web
```
