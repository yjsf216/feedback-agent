import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';

import 'client.dart';
import 'models.dart';

/// Lifecycle of the embeddable chat experience.
enum FeedbackChatPhase {
  idle,
  initializing,
  ready,
  sending,
  authRequired,
  error,
}

/// Author of a chat message.
enum FeedbackChatRole { user, assistant }

/// Delivery state rendered by the chat UI.
enum FeedbackChatMessageState { complete, streaming, error }

/// Immutable message model exposed to custom Flutter UIs.
class FeedbackChatMessage {
  const FeedbackChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.state,
    this.confidence,
    this.sources = const [],
  });

  /// Local or server message ID.
  final String id;

  /// User or assistant role.
  final FeedbackChatRole role;

  /// Current text, including accumulated stream deltas.
  final String content;

  /// Whether the message is complete, streaming, or retryable.
  final FeedbackChatMessageState state;

  /// Answer confidence in the inclusive range 0–1.
  final double? confidence;

  /// Knowledge sources cited by the answer.
  final List<FeedbackKnowledgeSource> sources;

  FeedbackChatMessage copyWith({
    String? id,
    String? content,
    FeedbackChatMessageState? state,
    double? confidence,
    List<FeedbackKnowledgeSource>? sources,
  }) {
    return FeedbackChatMessage(
      id: id ?? this.id,
      role: role,
      content: content ?? this.content,
      state: state ?? this.state,
      confidence: confidence ?? this.confidence,
      sources: sources ?? this.sources,
    );
  }
}

/// Coordinates identity, conversations, streaming, and resolution feedback.
class FeedbackChatController extends ChangeNotifier {
  FeedbackChatController({
    required this.gateway,
    this.locale = FeedbackLocale.zhCn,
    this.disposeGateway = true,
  });

  /// API gateway used by this controller.
  final FeedbackAgentGateway gateway;
  final bool disposeGateway;

  FeedbackLocale locale;
  FeedbackChatPhase _phase = FeedbackChatPhase.idle;
  FeedbackConversation? _conversation;
  final List<FeedbackChatMessage> _messages = [];
  String? _lastError;
  String? _pendingMessage;
  String? _lastFailedMessage;
  bool? _resolution;
  bool _resolutionSubmitting = false;
  int _localId = 0;
  bool _disposed = false;

  /// Current lifecycle state.
  FeedbackChatPhase get phase => _phase;

  /// Public application configuration after initialization.
  FeedbackAppConfig? get appConfig => gateway.appConfig;

  /// Current user session.
  FeedbackAuthSession? get session => gateway.session;

  /// Active conversation, created lazily on the first message.
  FeedbackConversation? get conversation => _conversation;

  /// Read-only message timeline.
  UnmodifiableListView<FeedbackChatMessage> get messages =>
      UnmodifiableListView(_messages);

  /// Last transport or platform error.
  String? get lastError => _lastError;

  /// Whether an answer is currently streaming.
  bool get isSending => _phase == FeedbackChatPhase.sending;

  /// Whether a resolution choice is being submitted.
  bool get isSubmittingResolution => _resolutionSubmitting;

  /// User's current resolution choice.
  bool? get resolution => _resolution;

  /// Whether at least one user message has been sent.
  bool get hasUserMessage =>
      _messages.any((message) => message.role == FeedbackChatRole.user);

  /// Loads configuration and any persisted session.
  Future<void> initialize() async {
    if (_phase == FeedbackChatPhase.initializing) return;
    if (_phase == FeedbackChatPhase.ready && appConfig != null) return;
    _phase = FeedbackChatPhase.initializing;
    _lastError = null;
    _notify();
    try {
      final config = await gateway.initialize();
      _messages
        ..clear()
        ..add(_welcome(config));
      _phase = FeedbackChatPhase.ready;
    } catch (error) {
      _lastError = _messageFor(error);
      _phase = FeedbackChatPhase.error;
    }
    _notify();
  }

  /// Sends a message or pauses in [FeedbackChatPhase.authRequired].
  Future<void> send(String value) async {
    final content = value.trim();
    if (content.isEmpty || isSending) return;
    if (appConfig == null) {
      await initialize();
      if (appConfig == null) return;
    }

    _lastError = null;
    _resolution = null;
    try {
      if (gateway.session == null) {
        final config = appConfig!;
        if (config.auth.guest) {
          await gateway.ensureGuestSession();
        } else {
          _pendingMessage = content;
          _phase = FeedbackChatPhase.authRequired;
          _notify();
          return;
        }
      }

      _conversation ??= await gateway.createConversation(
        locale: locale,
        metadata: const {'sdk': 'feedback_agent_flutter'},
      );
      await _stream(content);
    } catch (error) {
      _lastError = _messageFor(error);
      _lastFailedMessage = content;
      _phase = FeedbackChatPhase.ready;
      _notify();
    }
  }

  /// Retries the most recent message that failed to complete.
  Future<void> retryLastMessage() async {
    final content = _lastFailedMessage;
    if (content == null) return;
    await send(content);
  }

  /// Accepts a session returned by the host application's trusted backend.
  Future<void> adoptSession(FeedbackAuthSession session) async {
    await gateway.adoptSession(session);
    await _resumePendingMessage();
  }

  /// Logs in through the platform's optional email identity provider.
  Future<void> loginEmail({
    required String email,
    required String password,
  }) async {
    await gateway.loginEmail(email: email, password: password);
    await _resumePendingMessage();
  }

  /// Registers through the platform's optional email identity provider.
  Future<void> registerEmail({
    required String email,
    required String password,
    String? displayName,
  }) async {
    await gateway.registerEmail(
      email: email,
      password: password,
      displayName: displayName,
    );
    await _resumePendingMessage();
  }

  /// Records whether the conversation was resolved.
  Future<void> markResolution(bool resolved, {String? comment}) async {
    final active = _conversation;
    if (active == null || _resolutionSubmitting) return;
    _resolutionSubmitting = true;
    _lastError = null;
    _notify();
    try {
      await gateway.markResolution(
        conversationId: active.id,
        resolved: resolved,
        comment: comment,
      );
      _resolution = resolved;
      _conversation = active.copyWith(
        status: resolved
            ? FeedbackConversationStatus.resolved
            : FeedbackConversationStatus.unresolved,
      );
    } catch (error) {
      _lastError = _messageFor(error);
    } finally {
      _resolutionSubmitting = false;
      _notify();
    }
  }

  /// Closes the current conversation and resets the local timeline.
  Future<void> startNewConversation() async {
    final active = _conversation;
    if (active != null && active.status == FeedbackConversationStatus.open) {
      try {
        await gateway.closeConversation(active.id);
      } catch (error) {
        _lastError = _messageFor(error);
      }
    }
    _resetConversation();
  }

  /// Changes language and starts a fresh conversation.
  Future<void> setLocale(FeedbackLocale value) async {
    if (value == locale) return;
    locale = value;
    await startNewConversation();
  }

  /// Logs out and clears the local conversation.
  Future<void> logout() async {
    try {
      await gateway.logout();
    } finally {
      _resetConversation();
    }
  }

  Future<void> _stream(String content) async {
    final active = _conversation!;
    final userId = _nextId('user');
    final assistantId = _nextId('assistant');
    _messages.addAll([
      FeedbackChatMessage(
        id: userId,
        role: FeedbackChatRole.user,
        content: content,
        state: FeedbackChatMessageState.complete,
      ),
      FeedbackChatMessage(
        id: assistantId,
        role: FeedbackChatRole.assistant,
        content: '',
        state: FeedbackChatMessageState.streaming,
      ),
    ]);
    _phase = FeedbackChatPhase.sending;
    _pendingMessage = null;
    _notify();

    try {
      await for (final event in gateway.sendMessage(
        conversationId: active.id,
        content: content,
      )) {
        switch (event) {
          case FeedbackMessageStarted():
            break;
          case FeedbackMessageDelta(:final delta):
            _updateMessage(
              assistantId,
              (message) => message.copyWith(content: message.content + delta),
            );
          case FeedbackKnowledgeSourceEvent(:final source):
            _updateMessage(assistantId, (message) {
              final sources = [...message.sources];
              if (!sources.any((item) => item.id == source.id)) {
                sources.add(source);
              }
              return message.copyWith(sources: sources);
            });
          case FeedbackConversationState(:final status):
            _conversation = active.copyWith(status: status);
          case FeedbackMessageCompleted(
            :final messageId,
            :final content,
            :final confidence,
          ):
            _updateMessage(
              assistantId,
              (message) => message.copyWith(
                id: messageId,
                content: content,
                confidence: confidence,
                state: FeedbackChatMessageState.complete,
              ),
            );
          case FeedbackStreamFailure(:final code, :final message):
            throw FeedbackAgentException(message, code: code);
          case FeedbackUnknownEvent():
            break;
        }
        _notify();
      }
      final completed = _messageByIdOrNull(assistantId);
      if (completed != null &&
          completed.state == FeedbackChatMessageState.streaming) {
        if (completed.content.isEmpty) {
          throw const FeedbackAgentException(
            'The answer stream ended before a response was received.',
          );
        }
        _updateMessage(
          assistantId,
          (message) =>
              message.copyWith(state: FeedbackChatMessageState.complete),
        );
      }
      _lastFailedMessage = null;
    } catch (error) {
      _updateMessage(
        assistantId,
        (message) => message.copyWith(state: FeedbackChatMessageState.error),
      );
      _lastFailedMessage = content;
      _lastError = _messageFor(error);
    } finally {
      _phase = FeedbackChatPhase.ready;
      _notify();
    }
  }

  Future<void> _resumePendingMessage() async {
    final pending = _pendingMessage;
    _pendingMessage = null;
    _phase = FeedbackChatPhase.ready;
    _lastError = null;
    _notify();
    if (pending != null) unawaited(send(pending));
  }

  FeedbackChatMessage _welcome(FeedbackAppConfig config) {
    return FeedbackChatMessage(
      id: _nextId('welcome'),
      role: FeedbackChatRole.assistant,
      content: config.welcomeFor(locale),
      state: FeedbackChatMessageState.complete,
    );
  }

  void _resetConversation() {
    _conversation = null;
    _resolution = null;
    _pendingMessage = null;
    _lastFailedMessage = null;
    _lastError = null;
    final config = appConfig;
    _messages.clear();
    if (config != null) _messages.add(_welcome(config));
    _phase = config == null ? FeedbackChatPhase.idle : FeedbackChatPhase.ready;
    _notify();
  }

  void _updateMessage(
    String id,
    FeedbackChatMessage Function(FeedbackChatMessage message) update,
  ) {
    final index = _messages.indexWhere((message) => message.id == id);
    if (index >= 0) _messages[index] = update(_messages[index]);
  }

  FeedbackChatMessage? _messageByIdOrNull(String id) {
    final index = _messages.indexWhere((message) => message.id == id);
    return index < 0 ? null : _messages[index];
  }

  String _nextId(String prefix) => '$prefix-${_localId++}';

  String _messageFor(Object error) {
    return error is FeedbackAgentException
        ? error.message
        : 'The feedback request could not be completed.';
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    if (disposeGateway) gateway.dispose();
    super.dispose();
  }
}
