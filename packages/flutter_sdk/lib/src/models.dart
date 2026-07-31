import 'dart:convert';

/// Languages currently supported by the Feedback Agent platform.
enum FeedbackLocale {
  zhCn('zh-CN'),
  en('en');

  const FeedbackLocale(this.code);

  /// Locale code sent to the API.
  final String code;

  /// Converts an API locale code into a typed locale.
  static FeedbackLocale fromCode(String? code) {
    return code == FeedbackLocale.en.code
        ? FeedbackLocale.en
        : FeedbackLocale.zhCn;
  }
}

/// Authentication methods exposed by an application.
class FeedbackAuthOptions {
  const FeedbackAuthOptions({
    required this.guest,
    required this.email,
    required this.wechat,
  });

  factory FeedbackAuthOptions.fromJson(Map<String, Object?> json) {
    return FeedbackAuthOptions(
      guest: json['guest'] == true,
      email: json['email'] == true,
      wechat: json['wechat'] == true,
    );
  }

  /// Whether anonymous guest sessions are allowed.
  final bool guest;

  /// Whether email registration and login are allowed.
  final bool email;

  /// Whether the host has fully configured a WeChat identity flow.
  final bool wechat;
}

/// Public, non-secret configuration for one product application.
class FeedbackAppConfig {
  const FeedbackAppConfig({
    required this.id,
    required this.slug,
    required this.name,
    required this.primaryColor,
    required this.welcomeMessages,
    required this.suggestedQuestions,
    required this.auth,
  });

  factory FeedbackAppConfig.fromJson(Map<String, Object?> json) {
    final welcome = _map(json['welcomeMessages']);
    final suggestions = _map(json['suggestedQuestions']);
    return FeedbackAppConfig(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      primaryColor: json['primaryColor'] as String? ?? '#0F766E',
      welcomeMessages: {
        FeedbackLocale.zhCn: welcome[FeedbackLocale.zhCn.code] as String? ?? '',
        FeedbackLocale.en: welcome[FeedbackLocale.en.code] as String? ?? '',
      },
      suggestedQuestions: {
        FeedbackLocale.zhCn: _strings(suggestions[FeedbackLocale.zhCn.code]),
        FeedbackLocale.en: _strings(suggestions[FeedbackLocale.en.code]),
      },
      auth: FeedbackAuthOptions.fromJson(_map(json['auth'])),
    );
  }

  /// Platform UUID used in authenticated API requests.
  final String id;

  /// Stable public path identifier.
  final String slug;

  /// Product-facing display name.
  final String name;

  /// Six-digit hexadecimal brand color.
  final String primaryColor;

  /// Localized first assistant message.
  final Map<FeedbackLocale, String> welcomeMessages;

  /// Localized starter questions.
  final Map<FeedbackLocale, List<String>> suggestedQuestions;

  /// Enabled user identity methods.
  final FeedbackAuthOptions auth;

  /// Returns a localized welcome message with a safe fallback.
  String welcomeFor(FeedbackLocale locale) {
    return welcomeMessages[locale] ??
        welcomeMessages[FeedbackLocale.zhCn] ??
        '';
  }

  /// Returns localized starter questions.
  List<String> suggestionsFor(FeedbackLocale locale) {
    return suggestedQuestions[locale] ?? const [];
  }
}

/// User identity attached to an access token.
class FeedbackUser {
  const FeedbackUser({required this.id, this.displayName});

  factory FeedbackUser.fromJson(Map<String, Object?> json) {
    return FeedbackUser(
      id: json['id'] as String,
      displayName: json['displayName'] as String?,
    );
  }

  /// Canonical platform user ID.
  final String id;

  /// Optional user-facing name.
  final String? displayName;

  Map<String, Object?> toJson() => {'id': id, 'displayName': displayName};
}

/// How a locally stored session was created.
enum FeedbackIdentityKind { guest, email, host }

/// Short-lived access token and rotating refresh token.
class FeedbackAuthSession {
  const FeedbackAuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
    required this.identityKind,
  });

  factory FeedbackAuthSession.fromJson(
    Map<String, Object?> json, {
    FeedbackIdentityKind? identityKind,
  }) {
    final storedKind = json['identityKind'] as String?;
    return FeedbackAuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: (json['expiresIn'] as num).toInt(),
      user: FeedbackUser.fromJson(_map(json['user'])),
      identityKind:
          identityKind ??
          FeedbackIdentityKind.values.firstWhere(
            (value) => value.name == storedKind,
            orElse: () => FeedbackIdentityKind.host,
          ),
    );
  }

  /// JWT used in the Authorization header.
  final String accessToken;

  /// Rotating token used only to refresh the access token.
  final String refreshToken;

  /// Access token lifetime in seconds.
  final int expiresIn;

  /// Canonical end user.
  final FeedbackUser user;

  /// Session origin, used only for host UI decisions.
  final FeedbackIdentityKind identityKind;

  Map<String, Object?> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'expiresIn': expiresIn,
    'user': user.toJson(),
    'identityKind': identityKind.name,
  };

  /// Serializes a session for a secure key-value store.
  String encode() => jsonEncode(toJson());

  /// Restores a session from secure storage.
  static FeedbackAuthSession decode(String value) {
    return FeedbackAuthSession.fromJson(
      Map<String, Object?>.from(jsonDecode(value) as Map),
    );
  }
}

/// Conversation status returned by the platform.
enum FeedbackConversationStatus { open, resolved, unresolved, closed }

/// One feedback conversation owned by the authenticated user.
class FeedbackConversation {
  const FeedbackConversation({
    required this.id,
    required this.status,
    required this.locale,
  });

  factory FeedbackConversation.fromJson(Map<String, Object?> json) {
    return FeedbackConversation(
      id: json['id'] as String,
      status: _conversationStatus(json['status'] as String?),
      locale: FeedbackLocale.fromCode(json['locale'] as String?),
    );
  }

  /// Conversation UUID.
  final String id;

  /// Current resolution state.
  final FeedbackConversationStatus status;

  /// Language selected when the conversation was created.
  final FeedbackLocale locale;

  FeedbackConversation copyWith({FeedbackConversationStatus? status}) {
    return FeedbackConversation(
      id: id,
      status: status ?? this.status,
      locale: locale,
    );
  }
}

/// Knowledge item cited by an assistant answer.
class FeedbackKnowledgeSource {
  const FeedbackKnowledgeSource({
    required this.id,
    required this.title,
    this.url,
  });

  factory FeedbackKnowledgeSource.fromJson(Map<String, Object?> json) {
    return FeedbackKnowledgeSource(
      id: json['id'] as String,
      title: json['title'] as String,
      url: json['url'] as String?,
    );
  }

  final String id;
  final String title;
  final String? url;
}

/// Base type for events emitted by the SSE answer endpoint.
sealed class FeedbackStreamEvent {
  const FeedbackStreamEvent();

  factory FeedbackStreamEvent.fromJson(Map<String, Object?> json) {
    return switch (json['type']) {
      'message.start' => const FeedbackMessageStarted(),
      'message.delta' => FeedbackMessageDelta(json['delta'] as String? ?? ''),
      'knowledge.source' => FeedbackKnowledgeSourceEvent(
        FeedbackKnowledgeSource.fromJson(_map(json['source'])),
      ),
      'conversation.state' => FeedbackConversationState(
        _conversationStatus(json['status'] as String?),
      ),
      'message.completed' => FeedbackMessageCompleted(
        messageId: json['messageId'] as String,
        content: json['content'] as String? ?? '',
        confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      ),
      'error' => FeedbackStreamFailure(
        code: json['code'] as String? ?? 'MESSAGE_FAILED',
        message: json['message'] as String? ?? 'Message failed',
      ),
      _ => FeedbackUnknownEvent(Map.unmodifiable(json)),
    };
  }
}

final class FeedbackMessageStarted extends FeedbackStreamEvent {
  const FeedbackMessageStarted();
}

final class FeedbackMessageDelta extends FeedbackStreamEvent {
  const FeedbackMessageDelta(this.delta);
  final String delta;
}

final class FeedbackKnowledgeSourceEvent extends FeedbackStreamEvent {
  const FeedbackKnowledgeSourceEvent(this.source);
  final FeedbackKnowledgeSource source;
}

final class FeedbackConversationState extends FeedbackStreamEvent {
  const FeedbackConversationState(this.status);
  final FeedbackConversationStatus status;
}

final class FeedbackMessageCompleted extends FeedbackStreamEvent {
  const FeedbackMessageCompleted({
    required this.messageId,
    required this.content,
    required this.confidence,
  });

  final String messageId;
  final String content;
  final double confidence;
}

final class FeedbackStreamFailure extends FeedbackStreamEvent {
  const FeedbackStreamFailure({required this.code, required this.message});
  final String code;
  final String message;
}

final class FeedbackUnknownEvent extends FeedbackStreamEvent {
  const FeedbackUnknownEvent(this.data);
  final Map<String, Object?> data;
}

Map<String, Object?> _map(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return Map<String, Object?>.from(value);
  return const {};
}

List<String> _strings(Object? value) {
  if (value is! List) return const [];
  return value.whereType<String>().toList(growable: false);
}

FeedbackConversationStatus _conversationStatus(String? value) {
  return switch (value) {
    'RESOLVED' => FeedbackConversationStatus.resolved,
    'UNRESOLVED' => FeedbackConversationStatus.unresolved,
    'CLOSED' => FeedbackConversationStatus.closed,
    _ => FeedbackConversationStatus.open,
  };
}
