import 'package:feedback_agent_example/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows SDK integration entry points', (tester) async {
    await tester.pumpWidget(const FeedbackAgentExampleApp());

    expect(find.text('Feedback Agent'), findsOneWidget);
    expect(find.byKey(const Key('open-feedback')), findsOneWidget);
    expect(find.text('反馈与帮助'), findsOneWidget);
  });
}
