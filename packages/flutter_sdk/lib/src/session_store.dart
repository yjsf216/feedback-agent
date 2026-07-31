import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// Storage contract for session tokens and the stable anonymous user ID.
abstract interface class FeedbackSessionStore {
  Future<FeedbackAuthSession?> readSession(String namespace);
  Future<void> writeSession(String namespace, FeedbackAuthSession session);
  Future<void> clearSession(String namespace);
  Future<String?> readGuestId(String namespace);
  Future<void> writeGuestId(String namespace, String guestId);
}

/// Native secure-storage implementation used by default.
class SecureFeedbackSessionStore implements FeedbackSessionStore {
  SecureFeedbackSessionStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  String _sessionKey(String namespace) => 'feedback_agent.$namespace.session';
  String _guestKey(String namespace) => 'feedback_agent.$namespace.guest';

  @override
  Future<void> clearSession(String namespace) {
    return _storage.delete(key: _sessionKey(namespace));
  }

  @override
  Future<String?> readGuestId(String namespace) {
    return _storage.read(key: _guestKey(namespace));
  }

  @override
  Future<FeedbackAuthSession?> readSession(String namespace) async {
    final encoded = await _storage.read(key: _sessionKey(namespace));
    if (encoded == null || encoded.isEmpty) return null;
    try {
      return FeedbackAuthSession.decode(encoded);
    } on Object {
      await clearSession(namespace);
      return null;
    }
  }

  @override
  Future<void> writeGuestId(String namespace, String guestId) {
    return _storage.write(key: _guestKey(namespace), value: guestId);
  }

  @override
  Future<void> writeSession(String namespace, FeedbackAuthSession session) {
    return _storage.write(key: _sessionKey(namespace), value: session.encode());
  }
}

/// Volatile implementation suitable for tests and short-lived sessions.
class MemoryFeedbackSessionStore implements FeedbackSessionStore {
  final Map<String, FeedbackAuthSession> _sessions = {};
  final Map<String, String> _guestIds = {};

  @override
  Future<void> clearSession(String namespace) async {
    _sessions.remove(namespace);
  }

  @override
  Future<String?> readGuestId(String namespace) async => _guestIds[namespace];

  @override
  Future<FeedbackAuthSession?> readSession(String namespace) async {
    return _sessions[namespace];
  }

  @override
  Future<void> writeGuestId(String namespace, String guestId) async {
    _guestIds[namespace] = guestId;
  }

  @override
  Future<void> writeSession(
    String namespace,
    FeedbackAuthSession session,
  ) async {
    _sessions[namespace] = session;
  }
}
