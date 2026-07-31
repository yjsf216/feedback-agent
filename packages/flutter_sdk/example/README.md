# Feedback Agent Flutter example

This app demonstrates both SDK surfaces:

- a full-page feedback center;
- a floating launcher that opens an embedded modal chat.

Run against the seeded local `demo` app:

```sh
fvm flutter run -d chrome --web-port 8080
```

Override the backend or app slug when needed:

```sh
fvm flutter run -d chrome \
  --dart-define=FEEDBACK_API_URL=https://feedback-api.example.com \
  --dart-define=FEEDBACK_APP_SLUG=my-product
```

Android Emulator automatically uses `http://10.0.2.2:4100`. The Android debug
manifest permits cleartext traffic for this local example only.
