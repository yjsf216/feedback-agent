import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'session_store.dart';
import 'sse_decoder.dart';

/// A typed platform error with the HTTP status when one is available.
class FeedbackAgentException implements Exception {
  const FeedbackAgentException(this.message, {this.statusCode, this.code});

  /// Human-readable error returned by the platform.
  final String message;

  /// HTTP status code, or `null` for a local/transport error.
  final int? statusCode;

  /// Optional stable application error code.
  final String? code;

  @override
  String toString() => message;
}

/// Network contract consumed by [FeedbackChatController].
///
/// Implement this interface in tests, or use [FeedbackAgentClient] in an app.
abstract interface class FeedbackAgentGateway {
  /// Last public application configuration loaded by [initialize].
  FeedbackAppConfig? get appConfig;

  /// Current user session, if the user has authenticated.
  FeedbackAuthSession? get session;

  /// Loads public app configuration and restores a stored session.
  Future<FeedbackAppConfig> initialize();

  /// Creates or restores the stable guest identity for this app.
  Future<FeedbackAuthSession> ensureGuestSession();

  /// Logs in with an email identity.
  Future<FeedbackAuthSession> loginEmail({
    required String email,
    required String password,
  });

  /// Creates an email identity.
  Future<FeedbackAuthSession> registerEmail({
    required String email,
    required String password,
    String? displayName,
  });

  /// Stores tokens obtained by the host backend's signed exchange flow.
  Future<void> adoptSession(FeedbackAuthSession session);

  /// Starts one isolated feedback conversation.
  Future<FeedbackConversation> createConversation({
    required FeedbackLocale locale,
    Map<String, Object?>? metadata,
  });

  /// Sends a user message and emits typed SSE events.
  Stream<FeedbackStreamEvent> sendMessage({
    required String conversationId,
    required String content,
  });

  /// Marks whether the latest answer resolved the user's problem.
  Future<void> markResolution({
    required String conversationId,
    required bool resolved,
    String? comment,
  });

  /// Closes a conversation so a later message starts a new one.
  Future<void> closeConversation(String conversationId);

  /// Revokes the current refresh token and clears local session data.
  Future<void> logout();

  /// Releases resources owned by the gateway.
  void dispose();
}

/// API client for the reusable Feedback Agent backend.
///
/// No application secret is accepted here. Host-app SSO must call the signed
/// exchange endpoint from a trusted backend, then pass its token response to
/// [adoptSession].
class FeedbackAgentClient implements FeedbackAgentGateway {
  FeedbackAgentClient({
    required Uri baseUri,
    required this.appSlug,
    http.Client? httpClient,
    FeedbackSessionStore? sessionStore,
    Map<String, String> headers = const {},
  }) : _baseUri = Uri.parse(baseUri.toString().replaceFirst(RegExp(r'/$'), '')),
       _httpClient = httpClient ?? http.Client(),
       _ownsHttpClient = httpClient == null,
       _sessionStore = sessionStore ?? SecureFeedbackSessionStore(),
       _headers = Map.unmodifiable(headers);

  final Uri _baseUri;
  final http.Client _httpClient;
  final bool _ownsHttpClient;
  final FeedbackSessionStore _sessionStore;
  final Map<String, String> _headers;
  final Random _random = Random.secure();

  /// Public slug configured for the product application.
  final String appSlug;

  @override
  FeedbackAppConfig? appConfig;

  @override
  FeedbackAuthSession? session;

  bool _disposed = false;

  String get _namespace => '${_baseUri.host}:$appSlug';

  @override
  Future<FeedbackAppConfig> initialize() async {
    _checkNotDisposed();
    final response = await _httpClient.get(
      _uri('/v1/public/apps/${Uri.encodeComponent(appSlug)}/config'),
      headers: _headers,
    );
    final config = FeedbackAppConfig.fromJson(await _expectJson(response));
    appConfig = config;
    session = await _sessionStore.readSession(_namespace);
    return config;
  }

  @override
  Future<FeedbackAuthSession> ensureGuestSession() async {
    _checkNotDisposed();
    final existing = session;
    if (existing != null) return existing;
    final config = _requireConfig();
    if (!config.auth.guest) {
      throw const FeedbackAgentException(
        'This app does not allow guest access.',
      );
    }

    var guestId = await _sessionStore.readGuestId(_namespace);
    if (guestId == null || guestId.length < 8) {
      guestId = 'guest_${_uuidV4()}';
      await _sessionStore.writeGuestId(_namespace, guestId);
    }
    return _createSession('/v1/auth/guest', {
      'appId': config.id,
      'guestId': guestId,
    }, FeedbackIdentityKind.guest);
  }

  @override
  Future<FeedbackAuthSession> loginEmail({
    required String email,
    required String password,
  }) {
    final config = _requireEmailAuth();
    return _createSession('/v1/auth/email/login', {
      'appId': config.id,
      'email': email.trim(),
      'password': password,
    }, FeedbackIdentityKind.email);
  }

  @override
  Future<FeedbackAuthSession> registerEmail({
    required String email,
    required String password,
    String? displayName,
  }) {
    final config = _requireEmailAuth();
    return _createSession('/v1/auth/email/register', {
      'appId': config.id,
      'email': email.trim(),
      'password': password,
      if (displayName?.trim().isNotEmpty ?? false)
        'displayName': displayName!.trim(),
    }, FeedbackIdentityKind.email);
  }

  @override
  Future<void> adoptSession(FeedbackAuthSession session) async {
    _checkNotDisposed();
    this.session = session;
    await _sessionStore.writeSession(_namespace, session);
  }

  @override
  Future<FeedbackConversation> createConversation({
    required FeedbackLocale locale,
    Map<String, Object?>? metadata,
  }) async {
    final config = _requireConfig();
    final response = await _authenticatedRequest(
      'POST',
      '/v1/conversations',
      body: {
        'appId': config.id,
        'channel': 'FLUTTER',
        'locale': locale.code,
        'metadata': {'surface': 'flutter-sdk', ...?metadata},
      },
    );
    return FeedbackConversation.fromJson(await _expectJson(response));
  }

  @override
  Stream<FeedbackStreamEvent> sendMessage({
    required String conversationId,
    required String content,
  }) async* {
    final trimmed = content.trim();
    if (trimmed.isEmpty) {
      throw const FeedbackAgentException('Message cannot be empty.');
    }
    final response = await _authenticatedRequest(
      'POST',
      '/v1/conversations/${Uri.encodeComponent(conversationId)}/messages:stream',
      body: {'content': trimmed, 'clientMessageId': _uuidV4()},
      headers: const {'Accept': 'text/event-stream'},
    );
    yield* decodeFeedbackSse(response.stream);
  }

  @override
  Future<void> markResolution({
    required String conversationId,
    required bool resolved,
    String? comment,
  }) async {
    final response = await _authenticatedRequest(
      'POST',
      '/v1/conversations/${Uri.encodeComponent(conversationId)}/resolution',
      body: {
        'resolved': resolved,
        if (comment?.trim().isNotEmpty ?? false) 'comment': comment!.trim(),
      },
    );
    await _drain(response);
  }

  @override
  Future<void> closeConversation(String conversationId) async {
    final response = await _authenticatedRequest(
      'POST',
      '/v1/conversations/${Uri.encodeComponent(conversationId)}/close',
    );
    await _drain(response);
  }

  @override
  Future<void> logout() async {
    final activeSession = session;
    try {
      if (activeSession != null) {
        final response = await _sendJson(
          'POST',
          '/v1/auth/logout',
          body: {'refreshToken': activeSession.refreshToken},
        );
        if (response.statusCode != 204 && response.statusCode != 200) {
          await _throwResponse(response);
        }
      }
    } finally {
      session = null;
      await _sessionStore.clearSession(_namespace);
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    if (_ownsHttpClient) _httpClient.close();
  }

  FeedbackAppConfig _requireConfig() {
    _checkNotDisposed();
    final config = appConfig;
    if (config == null) {
      throw const FeedbackAgentException(
        'Call initialize() before using the Feedback Agent client.',
      );
    }
    return config;
  }

  FeedbackAppConfig _requireEmailAuth() {
    final config = _requireConfig();
    if (!config.auth.email) {
      throw const FeedbackAgentException(
        'This app does not allow email access.',
      );
    }
    return config;
  }

  Future<FeedbackAuthSession> _createSession(
    String path,
    Map<String, Object?> body,
    FeedbackIdentityKind identityKind,
  ) async {
    _checkNotDisposed();
    final response = await _sendJson('POST', path, body: body);
    final next = FeedbackAuthSession.fromJson(
      await _expectJson(response),
      identityKind: identityKind,
    );
    await adoptSession(next);
    return next;
  }

  Future<http.StreamedResponse> _authenticatedRequest(
    String method,
    String path, {
    Map<String, Object?>? body,
    Map<String, String> headers = const {},
  }) async {
    _checkNotDisposed();
    var activeSession = session;
    if (activeSession == null) {
      throw const FeedbackAgentException('Authentication is required.');
    }

    Future<http.StreamedResponse> send(String accessToken) {
      return _sendJson(
        method,
        path,
        body: body,
        headers: {...headers, 'Authorization': 'Bearer $accessToken'},
      );
    }

    var response = await send(activeSession.accessToken);
    if (response.statusCode == 401) {
      await response.stream.drain<void>();
      try {
        activeSession = await _refresh(activeSession);
      } catch (_) {
        session = null;
        await _sessionStore.clearSession(_namespace);
        rethrow;
      }
      response = await send(activeSession.accessToken);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      await _throwResponse(response);
    }
    return response;
  }

  Future<FeedbackAuthSession> _refresh(FeedbackAuthSession current) async {
    final response = await _sendJson(
      'POST',
      '/v1/auth/refresh',
      body: {'refreshToken': current.refreshToken},
    );
    final next = FeedbackAuthSession.fromJson(
      await _expectJson(response),
      identityKind: current.identityKind,
    );
    await adoptSession(next);
    return next;
  }

  Future<http.StreamedResponse> _sendJson(
    String method,
    String path, {
    Map<String, Object?>? body,
    Map<String, String> headers = const {},
  }) {
    final request = http.Request(method, _uri(path));
    request.headers.addAll({
      ..._headers,
      if (body != null) 'Content-Type': 'application/json',
      ...headers,
    });
    if (body != null) request.body = jsonEncode(body);
    return _httpClient.send(request);
  }

  Future<Map<String, Object?>> _expectJson(http.BaseResponse response) async {
    late final String raw;
    if (response is http.Response) {
      raw = response.body;
    } else if (response is http.StreamedResponse) {
      raw = await response.stream.bytesToString();
    } else {
      throw const FeedbackAgentException('Unsupported HTTP response.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _errorFromBody(response.statusCode, raw);
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) return Map<String, Object?>.from(decoded);
    } on FormatException {
      // Converted to a consistent SDK error below.
    }
    throw FeedbackAgentException(
      'The server returned an invalid response.',
      statusCode: response.statusCode,
    );
  }

  Future<void> _throwResponse(http.StreamedResponse response) async {
    final raw = await response.stream.bytesToString();
    throw _errorFromBody(response.statusCode, raw);
  }

  FeedbackAgentException _errorFromBody(int statusCode, String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        final map = Map<String, Object?>.from(decoded);
        final value = map['message'];
        final message = value is List
            ? value.whereType<Object>().map((item) => '$item').join('; ')
            : value?.toString();
        return FeedbackAgentException(
          message?.isNotEmpty == true ? message! : _fallbackError(statusCode),
          statusCode: statusCode,
          code: map['code'] as String?,
        );
      }
    } on FormatException {
      // Use a safe message for empty or proxy-generated responses.
    }
    return FeedbackAgentException(
      _fallbackError(statusCode),
      statusCode: statusCode,
    );
  }

  Future<void> _drain(http.StreamedResponse response) {
    return response.stream.drain<void>();
  }

  Uri _uri(String path) => Uri.parse('$_baseUri$path');

  String _fallbackError(int statusCode) {
    return statusCode >= 500
        ? 'The feedback service is temporarily unavailable.'
        : 'The request could not be completed.';
  }

  String _uuidV4() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }

  void _checkNotDisposed() {
    if (_disposed) {
      throw const FeedbackAgentException('FeedbackAgentClient is disposed.');
    }
  }
}
