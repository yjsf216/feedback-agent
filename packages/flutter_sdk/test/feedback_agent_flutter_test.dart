import 'dart:convert';

import 'package:feedback_agent_flutter/feedback_agent_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('models and storage', () {
    test('parses localized public app configuration', () {
      final config = FeedbackAppConfig.fromJson(_configJson());

      expect(config.slug, 'demo');
      expect(config.auth.guest, isTrue);
      expect(config.welcomeFor(FeedbackLocale.zhCn), '你好');
      expect(config.suggestionsFor(FeedbackLocale.en), ['Report a bug']);
    });

    test('round-trips an auth session in memory', () async {
      final store = MemoryFeedbackSessionStore();
      final session = _session();

      await store.writeSession('demo', session);
      await store.writeGuestId('demo', 'guest-stable-id');

      expect(await store.readSession('demo'), same(session));
      expect(await store.readGuestId('demo'), 'guest-stable-id');
      expect(
        FeedbackAuthSession.decode(session.encode()).identityKind,
        FeedbackIdentityKind.guest,
      );
    });
  });

  test('SSE decoder preserves chunk boundaries and multiline data', () async {
    final payload = <String>[
      'event: message.delta\n',
      'data: {"type":"message.delta",\n',
      'data: "delta":"你好"}\n\n',
      'data: {"type":"message.completed","messageId":',
      '"22222222-2222-4222-8222-222222222222",',
      '"content":"你好","confidence":0.91}\n\n',
    ];
    final chunks = Stream<List<int>>.fromIterable(payload.map(utf8.encode));

    final events = await decodeFeedbackSse(chunks).toList();

    expect(events, hasLength(2));
    expect((events.first as FeedbackMessageDelta).delta, '你好');
    expect((events.last as FeedbackMessageCompleted).confidence, 0.91);
  });

  test('controller drives guest conversation and resolution state', () async {
    final gateway = _FakeGateway(
      config: FeedbackAppConfig.fromJson(_configJson()),
    );
    final controller = FeedbackChatController(gateway: gateway);

    await controller.initialize();
    await controller.send('怎么导出数据？');

    expect(controller.phase, FeedbackChatPhase.ready);
    expect(controller.messages, hasLength(3));
    expect(controller.messages.last.content, '请在设置页导出。');
    expect(controller.messages.last.confidence, 0.93);
    expect(controller.messages.last.sources.single.title, '导出帮助');
    expect(gateway.createdLocale, FeedbackLocale.zhCn);

    await controller.markResolution(false);
    expect(controller.resolution, isFalse);
    expect(
      controller.conversation?.status,
      FeedbackConversationStatus.unresolved,
    );

    controller.dispose();
    expect(gateway.disposed, isTrue);
  });
}

Map<String, Object?> _configJson() => {
  'id': '11111111-1111-4111-8111-111111111111',
  'slug': 'demo',
  'name': '演示产品',
  'primaryColor': '#0F766E',
  'welcomeMessages': {'zh-CN': '你好', 'en': 'Hello'},
  'suggestedQuestions': {
    'zh-CN': ['报告问题'],
    'en': ['Report a bug'],
  },
  'auth': {'guest': true, 'email': true, 'wechat': false},
};

FeedbackAuthSession _session() => const FeedbackAuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token-that-is-long-enough',
  expiresIn: 900,
  user: FeedbackUser(id: 'user-1', displayName: '访客'),
  identityKind: FeedbackIdentityKind.guest,
);

class _FakeGateway implements FeedbackAgentGateway {
  _FakeGateway({required FeedbackAppConfig config}) : appConfig = config;

  @override
  FeedbackAppConfig? appConfig;

  @override
  FeedbackAuthSession? session;

  FeedbackLocale? createdLocale;
  bool disposed = false;

  @override
  Future<void> adoptSession(FeedbackAuthSession session) async {
    this.session = session;
  }

  @override
  Future<void> closeConversation(String conversationId) async {}

  @override
  Future<FeedbackConversation> createConversation({
    required FeedbackLocale locale,
    Map<String, Object?>? metadata,
  }) async {
    createdLocale = locale;
    return FeedbackConversation(
      id: '33333333-3333-4333-8333-333333333333',
      status: FeedbackConversationStatus.open,
      locale: locale,
    );
  }

  @override
  void dispose() => disposed = true;

  @override
  Future<FeedbackAuthSession> ensureGuestSession() async {
    session = _session();
    return session!;
  }

  @override
  Future<FeedbackAppConfig> initialize() async => appConfig!;

  @override
  Future<FeedbackAuthSession> loginEmail({
    required String email,
    required String password,
  }) async {
    session = _session();
    return session!;
  }

  @override
  Future<void> logout() async => session = null;

  @override
  Future<void> markResolution({
    required String conversationId,
    required bool resolved,
    String? comment,
  }) async {}

  @override
  Future<FeedbackAuthSession> registerEmail({
    required String email,
    required String password,
    String? displayName,
  }) {
    return loginEmail(email: email, password: password);
  }

  @override
  Stream<FeedbackStreamEvent> sendMessage({
    required String conversationId,
    required String content,
  }) async* {
    yield const FeedbackMessageStarted();
    yield const FeedbackKnowledgeSourceEvent(
      FeedbackKnowledgeSource(id: 'source-1', title: '导出帮助'),
    );
    yield const FeedbackMessageDelta('请在设置页');
    yield const FeedbackMessageDelta('导出。');
    yield const FeedbackMessageCompleted(
      messageId: '44444444-4444-4444-8444-444444444444',
      content: '请在设置页导出。',
      confidence: 0.93,
    );
  }
}
