import 'dart:convert';

import 'models.dart';

/// Decodes a byte stream that follows the Server-Sent Events wire format.
Stream<FeedbackStreamEvent> decodeFeedbackSse(Stream<List<int>> source) async* {
  var buffer = '';
  await for (final chunk in source.transform(utf8.decoder)) {
    buffer += chunk;
    final blocks = buffer.split(RegExp(r'\r?\n\r?\n'));
    buffer = blocks.removeLast();
    for (final block in blocks) {
      final event = _decodeBlock(block);
      if (event != null) yield event;
    }
  }
  if (buffer.trim().isNotEmpty) {
    final event = _decodeBlock(buffer);
    if (event != null) yield event;
  }
}

FeedbackStreamEvent? _decodeBlock(String block) {
  final data = block
      .split(RegExp(r'\r?\n'))
      .where((line) => line.startsWith('data:'))
      .map((line) => line.substring(5).trimLeft())
      .join('\n');
  if (data.isEmpty) return null;
  final decoded = jsonDecode(data);
  if (decoded is! Map) return null;
  return FeedbackStreamEvent.fromJson(Map<String, Object?>.from(decoded));
}
