import 'package:feedback_agent_flutter/feedback_agent_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

void main() {
  runApp(const FeedbackAgentExampleApp());
}

class FeedbackAgentExampleApp extends StatelessWidget {
  const FeedbackAgentExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    const ink = Color(0xff17231f);
    const teal = Color(0xff0f766e);
    const fontFallback = <String>[
      'PingFang SC',
      'Noto Sans CJK SC',
      'Microsoft YaHei',
    ];
    return MaterialApp(
      title: 'Feedback Agent Flutter SDK',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xfff2f6f3),
        colorScheme: ColorScheme.fromSeed(
          seedColor: teal,
          primary: teal,
          surface: const Color(0xfffffefb),
        ),
        textTheme: const TextTheme(
          displayMedium: TextStyle(
            color: ink,
            fontSize: 48,
            height: 1.08,
            fontWeight: FontWeight.w700,
            letterSpacing: -1.4,
            fontFamilyFallback: fontFallback,
          ),
          headlineSmall: TextStyle(
            color: ink,
            fontSize: 22,
            height: 1.3,
            fontWeight: FontWeight.w700,
            fontFamilyFallback: fontFallback,
          ),
          bodyLarge: TextStyle(
            color: Color(0xff53615c),
            fontSize: 16,
            height: 1.65,
            fontFamilyFallback: fontFallback,
          ),
          bodyMedium: TextStyle(
            color: ink,
            fontSize: 14,
            height: 1.55,
            fontFamilyFallback: fontFallback,
          ),
          labelLarge: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            fontFamilyFallback: fontFallback,
          ),
        ),
      ),
      home: const ExampleHomePage(),
    );
  }
}

class ExampleHomePage extends StatefulWidget {
  const ExampleHomePage({super.key});

  @override
  State<ExampleHomePage> createState() => _ExampleHomePageState();
}

class _ExampleHomePageState extends State<ExampleHomePage> {
  late final FeedbackAgentClient _client;
  late final FeedbackChatController _controller;

  @override
  void initState() {
    super.initState();
    _client = FeedbackAgentClient(
      baseUri: Uri.parse(feedbackApiUrl),
      appSlug: feedbackAppSlug,
    );
    _controller = FeedbackChatController(gateway: _client);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _openFeedback() {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) =>
            FeedbackChatPage(controller: _controller, onSourceTap: _showSource),
      ),
    );
  }

  void _showSource(FeedbackKnowledgeSource source) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('知识来源：${source.title}')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SelectionArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 96),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _TopBar(),
                    const SizedBox(height: 56),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final wide = constraints.maxWidth >= 820;
                        final intro = _Intro(onOpen: _openFeedback);
                        const card = _IntegrationCard();
                        if (!wide) {
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [intro, const SizedBox(height: 32), card],
                          );
                        }
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(flex: 6, child: intro),
                            const SizedBox(width: 64),
                            const Expanded(flex: 5, child: card),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 72),
                    const _WorkflowStrip(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
      floatingActionButton: FeedbackChatLauncher(
        controller: _controller,
        onSourceTap: _showSource,
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xffdff2ec),
            borderRadius: BorderRadius.circular(13),
          ),
          child: const Icon(Icons.hub_outlined, color: Color(0xff0f766e)),
        ),
        const SizedBox(width: 11),
        Text(
          'Feedback Agent',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xfffffefb),
            border: Border.all(color: const Color(0xffd8e2dd)),
            borderRadius: BorderRadius.circular(999),
          ),
          child: const Row(
            children: [
              Icon(Icons.flutter_dash, size: 16, color: Color(0xff1682a8)),
              SizedBox(width: 6),
              Text('Flutter SDK'),
            ],
          ),
        ),
      ],
    );
  }
}

class _Intro extends StatelessWidget {
  const _Intro({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final display = Theme.of(context).textTheme.displayMedium;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '把用户对话，\n变成可执行的产品反馈。',
          style: display?.copyWith(
            fontSize: MediaQuery.sizeOf(context).width < 560 ? 37 : null,
          ),
        ),
        const SizedBox(height: 22),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 610),
          child: Text(
            '这是可复用 Flutter SDK 的接入示例。它负责用户身份、流式问答、知识引用、问题解决确认，并把未解决问题交给后台继续跟进。',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
        const SizedBox(height: 30),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            FilledButton.icon(
              key: const Key('open-feedback'),
              onPressed: onOpen,
              icon: const Icon(Icons.forum_outlined),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 13),
                child: Text('打开反馈中心'),
              ),
            ),
            OutlinedButton.icon(
              onPressed: onOpen,
              icon: const Icon(Icons.open_in_full, size: 18),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 13),
                child: Text('查看完整页面'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Tag(icon: Icons.key_off_outlined, label: '客户端无密钥'),
            _Tag(icon: Icons.stream_outlined, label: 'SSE 流式回答'),
            _Tag(icon: Icons.devices_outlined, label: '多端复用'),
          ],
        ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xfffffefb),
        border: Border.all(color: const Color(0xffd8e2dd)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xff0f766e)),
          const SizedBox(width: 7),
          Text(label, style: Theme.of(context).textTheme.labelLarge),
        ],
      ),
    );
  }
}

class _IntegrationCard extends StatelessWidget {
  const _IntegrationCard();

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: -0.018,
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: const Color(0xff172d27),
          borderRadius: BorderRadius.circular(26),
          boxShadow: const [
            BoxShadow(
              color: Color(0x29172d27),
              blurRadius: 34,
              offset: Offset(0, 20),
            ),
          ],
        ),
        child: Transform.rotate(
          angle: 0.018,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.code, color: Color(0xff8ed8c3), size: 20),
                  SizedBox(width: 9),
                  Text(
                    '接入只需要三步',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const _CodeLine(number: '01', text: '创建 FeedbackAgentClient'),
              const _CodeLine(number: '02', text: '绑定 FeedbackChatController'),
              const _CodeLine(number: '03', text: '放入 Page、View 或 Launcher'),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: const Color(0xff0f211c),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xff315047)),
                ),
                child: Text(
                  'API  $feedbackApiUrl\nAPP  $feedbackAppSlug',
                  style: const TextStyle(
                    color: Color(0xffb9c9c3),
                    height: 1.6,
                    fontFamily: 'monospace',
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CodeLine extends StatelessWidget {
  const _CodeLine({required this.number, required this.text});

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xff24443a),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Text(
              number,
              style: const TextStyle(
                color: Color(0xff8ed8c3),
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(text, style: const TextStyle(color: Color(0xffe2ebe7))),
          ),
        ],
      ),
    );
  }
}

class _WorkflowStrip extends StatelessWidget {
  const _WorkflowStrip();

  @override
  Widget build(BuildContext context) {
    const steps = [
      (Icons.chat_bubble_outline, '对话采集'),
      (Icons.account_tree_outlined, '意图识别'),
      (Icons.category_outlined, '需求归类'),
      (Icons.insights_outlined, '痛点提炼'),
      (Icons.task_alt_outlined, '人工确认'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('从聊天入口到负责人队列', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: steps.indexed
              .map(
                (entry) => Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xfffffefb),
                    border: Border.all(color: const Color(0xffd8e2dd)),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${entry.$1 + 1}',
                        style: const TextStyle(
                          color: Color(0xff0f766e),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 9),
                      Icon(entry.$2.$1, size: 18),
                      const SizedBox(width: 7),
                      Text(entry.$2.$2),
                    ],
                  ),
                ),
              )
              .toList(growable: false),
        ),
      ],
    );
  }
}

const configuredFeedbackApiUrl = String.fromEnvironment('FEEDBACK_API_URL');
const feedbackAppSlug = String.fromEnvironment(
  'FEEDBACK_APP_SLUG',
  defaultValue: 'demo',
);

String get feedbackApiUrl {
  if (configuredFeedbackApiUrl.isNotEmpty) return configuredFeedbackApiUrl;
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:4100';
  }
  return 'http://localhost:4100';
}
